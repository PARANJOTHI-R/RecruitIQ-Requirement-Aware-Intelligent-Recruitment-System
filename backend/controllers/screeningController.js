import { pool } from '../config/postgresdb.js';
import { getSubmissionById } from '../models/submissionModel.js';
import { getResumeById } from '../models/resumeModel.js';
import { getJobById } from '../models/jobModel.js';
import { getJobSkills } from '../models/jobSkillModel.js';
import { createAnalysis, getAnalysisBySubmission } from '../models/screeningAnalysisModel.js';
import { insertSkillMatches, getMatchesByAnalysis } from '../models/skillMatchModel.js';
import { enqueue, getJob, generateBatchId } from '../services/jobQueue.js';

// aiService is injected after Phase 7
let _aiService = null;
export const setAiService = (svc) => { _aiService = svc; };

const buildJobProfile = (job, skills) => ({
    required_skills: skills.filter(s => s.is_required).map(s => s.skill_name),
    preferred_skills: skills.filter(s => !s.is_required).map(s => s.skill_name),
    minimum_experience_years: parseFloat(job.min_exp) || 0
});

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
            let matchType = null;
            if (matched) {
                const mt = (r.match_type || '').toLowerCase();
                const validTypes = ['exact', 'normalized', 'semantic', 'partial', 'related'];
                matchType = validTypes.includes(mt) ? mt : 'semantic';
            } else {
                matchType = 'missing';
            }
            rows.push({ jobSkillId, skillName: r.skill, matched, matchType,
                        similarityScore: r.similarity || null, evidence: r.evidence || null });
        }
    };
    processResults(scoreResult.required_results || []);
    processResults(scoreResult.preferred_results || []);
    return rows;
};

// Core screening logic — shared by single and batch handlers.
// Throws on failure so the caller can record the error.
export const runScreening = async (submissionId, userId) => {
    if (!_aiService) throw new Error('AI service not available');

    const submission = await getSubmissionById(submissionId);
    if (!submission) throw new Error('Submission not found');

    const resume = await getResumeById(submission.resume_id);
    if (!resume || resume.recruiter_id !== userId) throw new Error('Unauthorized');

    const job = await getJobById(submission.job_id);
    if (!job || job.recruiter_id !== userId) throw new Error('Unauthorized');

    if (!resume.parsed_resume_json) {
        throw new Error('Resume has not been parsed yet. Ensure AI service is running and re-upload.');
    }

    const jobSkills = await getJobSkills(submission.job_id);
    if (jobSkills.length === 0) throw new Error('Job has no skills defined');

    const jobProfile = buildJobProfile(job, jobSkills);
    const parsedData = typeof resume.parsed_resume_json === 'string'
        ? JSON.parse(resume.parsed_resume_json)
        : resume.parsed_resume_json;

    const candidateProfile = parsedData.candidate_profile;
    const resumeLines = parsedData.resume_lines || [];

    // AI call — the slow part; now runs off the request path
    const scoreResult = await _aiService.callScreen(jobProfile, candidateProfile, resumeLines);

    // One DB transaction per candidate (per-candidate isolation):
    // if this candidate fails, previously committed candidates are unaffected.
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
        throw new Error(`Failed to persist screening result: ${dbError.message}`);
    }
    client.release();

    const skillMatches = await getMatchesByAnalysis(analysis.analysis_id);
    return {
        analysis, skillMatches, scoreResult, candidateProfile, jobProfile,
        parsedData: {
            parse_method: parsedData.parse_method,
            validation: parsedData.validation,
            personal: parsedData.personal || parsedData.contact
        }
    };
};

// POST /api/screening/:submissionId — enqueue and return 202 immediately
// Job key uses 'sub:' namespace to avoid collision with insight jobs ('ins:') in the shared Map.
export const screenSubmissionHandler = async (req, res) => {
    const { submissionId } = req.params;
    if (!_aiService) return res.json({ success: false, message: 'AI service not available' });

    const jobKey = `sub:${submissionId}`;
    const existing = getJob(jobKey);
    if (existing && (existing.status === 'pending' || existing.status === 'processing')) {
        return res.status(202).json({ success: true, jobId: submissionId, status: existing.status });
    }

    enqueue(jobKey, () => runScreening(submissionId, req.userId));
    return res.status(202).json({ success: true, jobId: submissionId, status: 'pending' });
};

// GET /api/screening/job/:submissionId — poll single-job status; DB fallback on restart
export const getScreeningJobHandler = async (req, res) => {
    const { submissionId } = req.params;
    const jobKey = `sub:${submissionId}`;
    const job = getJob(jobKey);

    if (job) {
        if (job.status === 'complete') return res.json({ success: true, status: 'complete', ...job.result });
        if (job.status === 'failed')   return res.json({ success: false, status: 'failed', error: job.error });
        return res.json({ success: true, status: job.status });
    }

    // DB fallback — server restarted or job evicted by TTL.
    // NOTE: if a job failed AND was evicted, the DB will have no record (rolled-back tx),
    // so the status below will be 'not_started'. This is a known single-process limitation:
    // failed jobs are retained in memory for 30 min (vs 10 min for completed) to reduce this window.
    try {
        const analysis = await getAnalysisBySubmission(submissionId);
        if (analysis) {
            const skillMatches = await getMatchesByAnalysis(analysis.analysis_id);
            return res.json({ success: true, status: 'complete', analysis, skillMatches });
        }
        return res.json({ success: true, status: 'not_started' });
    } catch (error) {
        return res.json({ success: false, status: 'error', error: error.message });
    }
};

// Batch state store (UUID keys, no DB fallback)
const batchJobs = new Map();
const BATCH_CONCURRENCY = 4;

// POST /api/screening/batch — fan-out with concurrency cap; one tx per candidate
export const screenBatchHandler = async (req, res) => {
    const { submissionIds } = req.body;

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({ success: false, message: 'submissionIds must be a non-empty array' });
    }
    if (!_aiService) return res.json({ success: false, message: 'AI service not available' });

    // Bulk ownership + parse-status check — one query, not N
    const ownershipCheck = await pool.query(
        `SELECT rs.submission_id, r.recruiter_id, r.parser_status
         FROM resume_submissions rs
         JOIN resumes r ON r.resume_id = rs.resume_id
         WHERE rs.submission_id = ANY($1)`,
        [submissionIds]
    );

    const unauthorized = ownershipCheck.rows.filter(r => r.recruiter_id !== req.userId);
    if (unauthorized.length > 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized: one or more submissions do not belong to you' });
    }

    const screenable = ownershipCheck.rows
        .filter(r => r.parser_status === 'ok' || r.parser_status === 'degraded')
        .map(r => r.submission_id);

    if (screenable.length === 0) {
        return res.status(400).json({ success: false, message: 'No screenable submissions (resumes must be parsed first)' });
    }

    const batchJobId = generateBatchId();
    const userId = req.userId;
    const batchState = { status: 'processing', total: screenable.length, done: 0, failed: 0, results: [], createdAt: Date.now(), completedAt: null };
    batchJobs.set(batchJobId, batchState);

    setImmediate(async () => {
        const executing = new Set();
        for (const submissionId of screenable) {
            const p = Promise.resolve().then(async () => {
                try {
                    const result = await runScreening(submissionId, userId);
                    batchState.done++;
                    batchState.results.push({ submissionId, status: 'complete', analysisId: result.analysis?.analysis_id });
                } catch (err) {
                    batchState.failed++;
                    batchState.results.push({ submissionId, status: 'failed', error: err.message });
                    console.error(`[batch:${batchJobId}] ${submissionId} failed:`, err.message);
                }
            });
            executing.add(p);
            p.finally(() => executing.delete(p));
            if (executing.size >= BATCH_CONCURRENCY) await Promise.race(executing);
        }
        await Promise.allSettled([...executing]);
        batchState.status = 'complete';
        batchState.completedAt = Date.now();
    });

    return res.status(202).json({ success: true, batchJobId, total: screenable.length });
};

// GET /api/screening/batch/:batchJobId
export const getBatchJobHandler = (req, res) => {
    const { batchJobId } = req.params;
    const batch = batchJobs.get(batchJobId);
    if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch job not found (may have expired or server restarted)' });
    }
    return res.json({ success: true, status: batch.status, total: batch.total, done: batch.done, failed: batch.failed, results: batch.results });
};

// TTL eviction for batch jobs
const batchEvict = setInterval(() => {
    const now = Date.now();
    for (const [id, b] of batchJobs.entries()) {
        if (b.status === 'complete' && b.completedAt && now - b.completedAt > 10 * 60 * 1000) {
            batchJobs.delete(id);
        }
    }
}, 5 * 60 * 1000);
if (batchEvict.unref) batchEvict.unref();

// GET /api/screening/:submissionId — retrieve persisted analysis (unchanged)
export const getAnalysisHandler = async (req, res) => {
    const { submissionId } = req.params;
    try {
        const submission = await getSubmissionById(submissionId);
        if (!submission) return res.json({ success: false, message: 'Submission not found' });

        const resume = await getResumeById(submission.resume_id);
        if (!resume || resume.recruiter_id !== req.userId) return res.json({ success: false, message: 'Unauthorized' });

        const analysis = await getAnalysisBySubmission(submissionId);
        if (!analysis) return res.json({ success: false, message: 'No analysis found for this submission' });

        const skillMatches = await getMatchesByAnalysis(analysis.analysis_id);
        return res.json({ success: true, analysis, skillMatches });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};