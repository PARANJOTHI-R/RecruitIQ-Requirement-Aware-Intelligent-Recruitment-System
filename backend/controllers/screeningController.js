import { pool } from '../config/postgresdb.js';
import { getSubmissionById } from '../models/submissionModel.js';
import { getResumeById } from '../models/resumeModel.js';
import { getJobById } from '../models/jobModel.js';
import { getJobSkills } from '../models/jobSkillModel.js';
import { createAnalysis, getAnalysisBySubmission } from '../models/screeningAnalysisModel.js';
import { insertSkillMatches, getMatchesByAnalysis } from '../models/skillMatchModel.js';

// aiService is injected after Phase 7
let _aiService = null;
export const setAiService = (svc) => { _aiService = svc; };

// Build the job_profile dict that matches what analyze_job_description() produces.
// Express builds this from the DB rather than re-parsing the JD text.
const buildJobProfile = (job, skills) => {
    const required = skills
        .filter(s => s.is_required)
        .map(s => s.skill_name);
    const preferred = skills
        .filter(s => !s.is_required)
        .map(s => s.skill_name);

    return {
        required_skills: required,
        preferred_skills: preferred,
        minimum_experience_years: parseFloat(job.min_exp) || 0
    };
};

// Map the score_result from Python to skill_match rows.
// Needs job_skills to resolve job_skill_id per skill name.
const buildSkillMatchRows = (scoreResult, jobSkills) => {
    const skillIdByName = {};
    for (const js of jobSkills) {
        skillIdByName[js.skill_name.toLowerCase()] = js.job_skill_id;
    }

    const rows = [];

    const processResults = (results) => {
        for (const r of results) {
            const jobSkillId = skillIdByName[r.skill.toLowerCase()] || null;
            const matched = r.status === 'MATCH' || r.status === 'RELATED';

            // Map Python match_type to schema CHECK values
            let matchType = null;
            if (matched) {
                const mt = (r.match_type || '').toLowerCase();
                const validTypes = ['exact', 'normalized', 'semantic', 'partial', 'related'];
                matchType = validTypes.includes(mt) ? mt : 'semantic';
            } else {
                matchType = 'missing';
            }

            rows.push({
                jobSkillId,
                skillName: r.skill,
                matched,
                matchType,
                similarityScore: r.similarity || null,
                evidence: r.evidence || null
            });
        }
    };

    processResults(scoreResult.required_results || []);
    processResults(scoreResult.preferred_results || []);

    return rows;
};

export const screenSubmissionHandler = async (req, res) => {
    const { submissionId } = req.params;

    if (!_aiService) {
        return res.json({ success: false, message: 'AI service not available' });
    }

    try {
        // 1. Load submission
        const submission = await getSubmissionById(submissionId);
        if (!submission) {
            return res.json({ success: false, message: 'Submission not found' });
        }

        // 2. Verify ownership chain: submission → resume → recruiter
        const resume = await getResumeById(submission.resume_id);
        if (!resume || resume.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        // 3. Verify ownership chain: submission → job → recruiter
        const job = await getJobById(submission.job_id);
        if (!job || job.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        // 4. Resume must be parsed
        if (!resume.parsed_resume_json) {
            return res.json({
                success: false,
                message: 'Resume has not been parsed yet. Ensure AI service is running and re-upload.'
            });
        }

        // 5. Load job skills
        const jobSkills = await getJobSkills(submission.job_id);
        if (jobSkills.length === 0) {
            return res.json({ success: false, message: 'Job has no skills defined' });
        }

        // 6. Build job_profile from DB data (same shape as analyze_job_description())
        const jobProfile = buildJobProfile(job, jobSkills);

        // 7. Extract candidate_profile and resume_lines from stored parse result
        const parsedData = typeof resume.parsed_resume_json === 'string'
            ? JSON.parse(resume.parsed_resume_json)
            : resume.parsed_resume_json;

        const candidateProfile = parsedData.candidate_profile;
        const resumeLines = parsedData.resume_lines || [];

        // 8. Call existing AI pipeline via service
        let scoreResult;
        try {
            scoreResult = await _aiService.callScreen(jobProfile, candidateProfile, resumeLines);
        } catch (aiError) {
            return res.json({ success: false, message: `AI service error: ${aiError.message}` });
        }

        // 9. Persist screening_analyses + skill_matches atomically
        const client = await pool.connect();
        let analysis;
        try {
            await client.query('BEGIN');

            analysis = await createAnalysis(client, {
                submissionId,
                scoreResult,
                candidateYears: candidateProfile.experience_years || null
            });

            const matchRows = buildSkillMatchRows(scoreResult, jobSkills);
            await insertSkillMatches(client, analysis.analysis_id, matchRows);

            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            client.release();
            console.error('Screening persistence error:', dbError.message);
            return res.json({ success: false, message: 'Failed to persist screening result' });
        }
        client.release();

        // 10. Load the persisted matches to include in response
        const skillMatches = await getMatchesByAnalysis(analysis.analysis_id);

        return res.json({
            success: true,
            analysis,
            skillMatches,
            scoreResult,
            candidateProfile,
            jobProfile,
            parsedData: {
                parse_method: parsedData.parse_method,
                validation: parsedData.validation,
                personal: parsedData.personal || parsedData.contact
            }
        });

    } catch (error) {
        console.error('Screening error:', error);
        return res.json({ success: false, message: error.message });
    }
};

export const getAnalysisHandler = async (req, res) => {
    const { submissionId } = req.params;

    try {
        // Verify ownership chain
        const submission = await getSubmissionById(submissionId);
        if (!submission) {
            return res.json({ success: false, message: 'Submission not found' });
        }

        const resume = await getResumeById(submission.resume_id);
        if (!resume || resume.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        const analysis = await getAnalysisBySubmission(submissionId);
        if (!analysis) {
            return res.json({ success: false, message: 'No analysis found for this submission' });
        }

        const skillMatches = await getMatchesByAnalysis(analysis.analysis_id);
        return res.json({ success: true, analysis, skillMatches });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
