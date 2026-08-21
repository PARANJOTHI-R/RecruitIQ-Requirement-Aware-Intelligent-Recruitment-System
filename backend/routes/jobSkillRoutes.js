import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    addSkillsHandler,
    getSkillsHandler,
    deleteSkillHandler
} from '../controllers/jobSkillController.js';

const jobSkillRouter = express.Router({ mergeParams: true });

// Routes are mounted under /api/jobs/:jobId/skills
jobSkillRouter.post('/',           userAuth, addSkillsHandler);
jobSkillRouter.get('/',            userAuth, getSkillsHandler);
jobSkillRouter.delete('/:skillId', userAuth, deleteSkillHandler);

export default jobSkillRouter;
