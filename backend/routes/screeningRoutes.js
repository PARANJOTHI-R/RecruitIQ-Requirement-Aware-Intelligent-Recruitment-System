import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    screenSubmissionHandler,
    getAnalysisHandler
} from '../controllers/screeningController.js';

const screeningRouter = express.Router();

// POST  /api/screening/:submissionId  — run screening pipeline
// GET   /api/screening/:submissionId  — retrieve persisted analysis
screeningRouter.post('/:submissionId', userAuth, screenSubmissionHandler);
screeningRouter.get('/:submissionId',  userAuth, getAnalysisHandler);

export default screeningRouter;
