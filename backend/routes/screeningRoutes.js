import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    screenSubmissionHandler,
    getScreeningJobHandler,
    screenBatchHandler,
    getBatchJobHandler,
    getAnalysisHandler
} from '../controllers/screeningController.js';

const screeningRouter = express.Router();

// Static paths must come before parameterised paths to avoid Express capturing
// the literal string "batch" or "job" as a :submissionId value.

// POST /api/screening/batch             — start batch screening (Issue 2)
// GET  /api/screening/batch/:batchJobId — poll batch progress  (Issue 2)
screeningRouter.post('/batch',              userAuth, screenBatchHandler);
screeningRouter.get('/batch/:batchJobId',   userAuth, getBatchJobHandler);

// GET  /api/screening/job/:submissionId  — poll single-job status (Issue 1)
screeningRouter.get('/job/:submissionId',   userAuth, getScreeningJobHandler);

// POST /api/screening/:submissionId      — enqueue screening (Issue 1, was sync)
// GET  /api/screening/:submissionId      — retrieve persisted analysis
screeningRouter.post('/:submissionId',      userAuth, screenSubmissionHandler);
screeningRouter.get('/:submissionId',       userAuth, getAnalysisHandler);

export default screeningRouter;