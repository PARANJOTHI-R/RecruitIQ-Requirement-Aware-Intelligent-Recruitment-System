import { getAnalysisById, getAnalysisBySubmission } from '../models/screeningAnalysisModel.js';
import { getMatchesByAnalysis } from '../models/skillMatchModel.js';
import { createOrUpdateInsight, getInsightByAnalysis } from '../models/aiInsightModel.js';
import { getSubmissionById } from '../models/submissionModel.js';
import { getResumeById } from '../models/resumeModel.js';
import { getJobById } from '../models/jobModel.js';
import { getJobSkills } from '../models/jobSkillModel.js';

// aiService injected after Phase 7
let _aiService = null;
export const setAiService = (svc) => { _aiService = svc; };

// Verify recruiter owns the analysis via the submission → resume → recruiter chain
const verifyAnalysisOwnership = async (analysisId, recruiterId) => {
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) return { ok: false, message: 'Analysis not found' };

    const submission = await getSubmissionById(analysis.submission_id);
    if (!submission) return { ok: false, message: 'Submission not found' };

    const resume = await getResumeById(submission.resume_id);
    if (!resume) return { ok: false, message: 'Resume not found' };
    if (resume.recruiter_id !== recruiterId) return { ok: false, message: 'Unauthorized' };

    const job = await getJobById(submission.job_id);

    return { ok: true, analysis, submission, resume, job };
};

export const analyzeJdHandler = async (req, res) => {
    const { jdText } = req.body;
    if (!jdText) {
        return res.json({ success: false, message: 'jdText is required' });
    }
    if (!_aiService) {
        return res.json({ success: false, message: 'AI service not available' });
    }
    try {
        const jobProfile = await _aiService.callAnalyzeJd(jdText);
        return res.json({ success: true, jobProfile });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const getInsightsHandler = async (req, res) => {
    const { analysisId } = req.params;

    if (!_aiService) {
        return res.json({ success: false, status: 'unavailable', message: 'AI service not available' });
    }

    try {
        const ownership = await verifyAnalysisOwnership(analysisId, req.userId);
        if (!ownership.ok) {
            return res.json({ success: false, message: ownership.message });
        }

        const { analysis, submission, resume, job } = ownership;

        // Return cached insight if already persisted
        const cached = await getInsightByAnalysis(analysisId);
        if (cached) {
            return res.json({ success: true, status: 'ok', insight: cached, cached: true });
        }

        // Build context for Gemini — same fields as the existing generate_recruiter_insights() expects
        const parsedData = typeof resume.parsed_resume_json === 'string'
            ? JSON.parse(resume.parsed_resume_json)
            : resume.parsed_resume_json;

        const candidateProfile = parsedData.candidate_profile;

        const jobSkills = await getJobSkills(submission.job_id);
        const jobProfile = {
            required_skills: jobSkills.filter(s => s.is_required).map(s => s.skill_name),
            preferred_skills: jobSkills.filter(s => !s.is_required).map(s => s.skill_name),
            minimum_experience_years: parseFloat(job.min_exp) || 0
        };

        const skillMatches = await getMatchesByAnalysis(analysisId);

        // Reconstruct score_result shape that gemini_insights.py expects
        const scoreResult = {
            overall_score: parseFloat(analysis.overall_score),
            required_skill_fit: parseFloat(analysis.required_skill_score),
            preferred_skill_fit: parseFloat(analysis.preferred_skill_score),
            experience_fit: analysis.experience_score ? parseFloat(analysis.experience_score) : null,
            required_results: skillMatches
                .filter(m => {
                    const js = jobSkills.find(js => js.job_skill_id === m.job_skill_id);
                    return js?.is_required;
                })
                .map(m => ({
                    skill: m.skill_name,
                    status: m.matched ? 'MATCH' : 'MISSING',
                    match_type: m.match_type === 'missing' ? null : m.match_type,
                    evidence: m.evidence || null,
                    similarity: m.similarity_score ? parseFloat(m.similarity_score) : null
                })),
            preferred_results: skillMatches
                .filter(m => {
                    const js = jobSkills.find(js => js.job_skill_id === m.job_skill_id);
                    return js && !js.is_required;
                })
                .map(m => ({
                    skill: m.skill_name,
                    status: m.matched ? 'MATCH' : 'MISSING',
                    match_type: m.match_type === 'missing' ? null : m.match_type,
                    evidence: m.evidence || null,
                    similarity: m.similarity_score ? parseFloat(m.similarity_score) : null
                }))
        };

        // Call Gemini — on-demand only
        let insightData;
        try {
            insightData = await _aiService.callInsights(candidateProfile, jobProfile, scoreResult);
        } catch (aiError) {
            return res.json({ success: false, status: 'unavailable', message: aiError.message });
        }

        if (insightData.status !== 'ok') {
            return res.json({
                success: false,
                status: 'unavailable',
                message: insightData.reason || 'AI insights unavailable'
            });
        }

        // Persist to ai_insights
        const saved = await createOrUpdateInsight(analysisId, {
            insightData,
            modelName: process.env.GEMINI_MODEL || 'gemini'
        });

        return res.json({ success: true, status: 'ok', insight: saved, raw: insightData });

    } catch (error) {
        console.error('Insights error:', error);
        return res.json({ success: false, status: 'unavailable', message: error.message });
    }
};

export const chatHandler = async (req, res) => {
    const { analysisId } = req.params;
    const { question, conversation } = req.body;

    if (!question || !question.trim()) {
        return res.json({ success: false, message: 'Question is required' });
    }

    if (!_aiService) {
        return res.json({ success: false, status: 'unavailable', message: 'AI service not available' });
    }

    try {
        const ownership = await verifyAnalysisOwnership(analysisId, req.userId);
        if (!ownership.ok) {
            return res.json({ success: false, message: ownership.message });
        }

        const { analysis, submission, resume, job } = ownership;

        const parsedData = typeof resume.parsed_resume_json === 'string'
            ? JSON.parse(resume.parsed_resume_json)
            : resume.parsed_resume_json;

        const candidateProfile = parsedData.candidate_profile;

        const jobSkills = await getJobSkills(submission.job_id);
        const jobProfile = {
            required_skills: jobSkills.filter(s => s.is_required).map(s => s.skill_name),
            preferred_skills: jobSkills.filter(s => !s.is_required).map(s => s.skill_name),
            minimum_experience_years: parseFloat(job.min_exp) || 0
        };

        const skillMatches = await getMatchesByAnalysis(analysisId);
        const scoreResult = {
            overall_score: parseFloat(analysis.overall_score),
            required_skill_fit: parseFloat(analysis.required_skill_score),
            preferred_skill_fit: parseFloat(analysis.preferred_skill_score),
            experience_fit: analysis.experience_score ? parseFloat(analysis.experience_score) : null,
            required_results: skillMatches.map(m => ({
                skill: m.skill_name,
                status: m.matched ? 'MATCH' : 'MISSING',
                match_type: m.match_type,
                evidence: m.evidence || null,
                similarity: m.similarity_score ? parseFloat(m.similarity_score) : null
            })),
            preferred_results: []
        };

        // Conversation context comes from the frontend (no DB storage)
        const conversationHistory = Array.isArray(conversation) ? conversation : [];

        let response;
        try {
            response = await _aiService.callChat(
                candidateProfile,
                jobProfile,
                scoreResult,
                conversationHistory,
                question.trim()
            );
        } catch (aiError) {
            return res.json({ success: false, status: 'unavailable', message: aiError.message });
        }

        return res.json({
            success: response.status === 'ok',
            status: response.status,
            answer: response.answer || null,
            message: response.answer || response.reason || 'Unable to generate answer'
        });

    } catch (error) {
        console.error('Chat error:', error);
        return res.json({ success: false, status: 'unavailable', message: error.message });
    }
};
