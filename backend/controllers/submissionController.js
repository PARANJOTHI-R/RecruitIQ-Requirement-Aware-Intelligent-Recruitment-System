import {
    createSubmission,
    getSubmissionById,
    findSubmission,
    getSubmissionsByJob,
    getSubmissionsByResume
} from '../models/submissionModel.js';
import { getResumeById } from '../models/resumeModel.js';
import { getJobById } from '../models/jobModel.js';

export const createSubmissionHandler = async (req, res) => {
    const { resumeId, jobId } = req.body;

    if (!resumeId || !jobId) {
        return res.json({ success: false, message: 'resumeId and jobId are required' });
    }

    try {
        // Verify recruiter owns the resume
        const resume = await getResumeById(resumeId);
        if (!resume) {
            return res.json({ success: false, message: 'Resume not found' });
        }
        if (resume.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized: resume does not belong to you' });
        }

        // Verify recruiter owns the job
        const job = await getJobById(jobId);
        if (!job) {
            return res.json({ success: false, message: 'Job not found' });
        }
        if (job.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized: job does not belong to you' });
        }

        // Check for duplicate
        const existing = await findSubmission(resumeId, jobId);
        if (existing) {
            return res.json({
                success: false,
                message: 'This resume has already been submitted to this job',
                submission: existing
            });
        }

        const submission = await createSubmission({ resumeId, jobId });
        return res.json({ success: true, submission });

    } catch (error) {
        if (error.code === '23505') {
            return res.json({ success: false, message: 'Duplicate submission: already submitted' });
        }
        return res.json({ success: false, message: error.message });
    }
};

export const getSubmissionsByJobHandler = async (req, res) => {
    const { jobId } = req.params;
    try {
        const job = await getJobById(jobId);
        if (!job) return res.json({ success: false, message: 'Job not found' });
        if (job.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        const submissions = await getSubmissionsByJob(jobId);
        return res.json({ success: true, submissions });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const getSubmissionsByResumeHandler = async (req, res) => {
    const { resumeId } = req.params;
    try {
        const resume = await getResumeById(resumeId);
        if (!resume) return res.json({ success: false, message: 'Resume not found' });
        if (resume.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        const submissions = await getSubmissionsByResume(resumeId);
        return res.json({ success: true, submissions });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
