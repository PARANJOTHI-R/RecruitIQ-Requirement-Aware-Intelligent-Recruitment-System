import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    createJobHandler,
    getJobsHandler,
    getJobHandler,
    updateJobHandler,
    deleteJobHandler
} from '../controllers/jobController.js';
import { getJobWorkspaceHandler } from '../controllers/jobWorkspaceController.js';

const jobRouter = express.Router();

jobRouter.post('/',      userAuth, createJobHandler);
jobRouter.get('/',       userAuth, getJobsHandler);
jobRouter.get('/:id',   userAuth, getJobHandler);
jobRouter.get('/:id/workspace', userAuth, getJobWorkspaceHandler);
jobRouter.put('/:id',   userAuth, updateJobHandler);
jobRouter.delete('/:id', userAuth, deleteJobHandler);

export default jobRouter;
