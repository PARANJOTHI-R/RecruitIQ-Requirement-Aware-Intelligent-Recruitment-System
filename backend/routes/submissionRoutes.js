import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    createSubmissionHandler,
    getSubmissionsByJobHandler,
    getSubmissionsByResumeHandler
} from '../controllers/submissionController.js';

const submissionRouter = express.Router();

submissionRouter.post('/',                      userAuth, createSubmissionHandler);
submissionRouter.get('/job/:jobId',             userAuth, getSubmissionsByJobHandler);
submissionRouter.get('/resume/:resumeId',       userAuth, getSubmissionsByResumeHandler);

export default submissionRouter;
