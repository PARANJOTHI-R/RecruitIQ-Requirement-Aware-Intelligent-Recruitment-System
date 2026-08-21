import {
    createJob,
    getJobsByRecruiter,
    getJobById,
    updateJob,
    deleteJob
} from '../models/jobModel.js';

export const createJobHandler = async (req, res) => {
    const { title, description, minExp, reqEdu, status } = req.body;

    if (!title) {
        return res.json({ success: false, message: 'Job title is required' });
    }

    try {
        const job = await createJob({
            recruiterId: req.userId,
            title,
            description,
            minExp,
            reqEdu,
            status
        });
        return res.json({ success: true, job });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const getJobsHandler = async (req, res) => {
    try {
        const jobs = await getJobsByRecruiter(req.userId);
        return res.json({ success: true, jobs });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const getJobHandler = async (req, res) => {
    const { id } = req.params;
    try {
        const job = await getJobById(id);

        if (!job) {
            return res.json({ success: false, message: 'Job not found' });
        }

        if (job.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        return res.json({ success: true, job });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const updateJobHandler = async (req, res) => {
    const { id } = req.params;
    const { title, description, minExp, reqEdu, status } = req.body;

    try {
        const existing = await getJobById(id);
        if (!existing) {
            return res.json({ success: false, message: 'Job not found' });
        }
        if (existing.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        const job = await updateJob(id, { title, description, minExp, reqEdu, status });
        return res.json({ success: true, job });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const deleteJobHandler = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await getJobById(id);
        if (!existing) {
            return res.json({ success: false, message: 'Job not found' });
        }
        if (existing.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        await deleteJob(id);
        return res.json({ success: true, message: 'Job deleted' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
