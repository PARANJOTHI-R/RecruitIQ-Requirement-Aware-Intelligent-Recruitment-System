import {
    addJobSkill,
    addJobSkillsBatch,
    getJobSkills,
    getJobSkillById,
    deleteJobSkill
} from '../models/jobSkillModel.js';
import { getJobById } from '../models/jobModel.js';

// Helper: verify recruiter owns this job
const verifyJobOwnership = async (jobId, recruiterId) => {
    const job = await getJobById(jobId);
    if (!job) return { ok: false, message: 'Job not found' };
    if (job.recruiter_id !== recruiterId) return { ok: false, message: 'Unauthorized' };
    return { ok: true, job };
};

export const addSkillsHandler = async (req, res) => {
    const { jobId } = req.params;
    // Accept either a single skill { skillName, isRequired }
    // or a batch { skills: [{ skillName, isRequired }] }
    const { skillName, isRequired, skills } = req.body;

    try {
        const ownership = await verifyJobOwnership(jobId, req.userId);
        if (!ownership.ok) {
            return res.json({ success: false, message: ownership.message });
        }

        if (skills && Array.isArray(skills)) {
            if (skills.length === 0) {
                return res.json({ success: false, message: 'Skills array is empty' });
            }
            const added = await addJobSkillsBatch(jobId, skills);
            return res.json({ success: true, skills: added });
        }

        if (!skillName) {
            return res.json({ success: false, message: 'skillName is required' });
        }

        const skill = await addJobSkill({ jobId, skillName, isRequired });
        return res.json({ success: true, skill });
    } catch (error) {
        // Catch unique constraint violation
        if (error.code === '23505') {
            return res.json({ success: false, message: 'Skill already exists for this job' });
        }
        return res.json({ success: false, message: error.message });
    }
};

export const getSkillsHandler = async (req, res) => {
    const { jobId } = req.params;
    try {
        const ownership = await verifyJobOwnership(jobId, req.userId);
        if (!ownership.ok) {
            return res.json({ success: false, message: ownership.message });
        }

        const skills = await getJobSkills(jobId);
        return res.json({ success: true, skills });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const deleteSkillHandler = async (req, res) => {
    const { jobId, skillId } = req.params;
    try {
        const ownership = await verifyJobOwnership(jobId, req.userId);
        if (!ownership.ok) {
            return res.json({ success: false, message: ownership.message });
        }

        // Verify skill belongs to this job
        const skill = await getJobSkillById(skillId);
        if (!skill || skill.job_id !== jobId) {
            return res.json({ success: false, message: 'Skill not found for this job' });
        }

        await deleteJobSkill(skillId);
        return res.json({ success: true, message: 'Skill deleted' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
