import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    analyzeJdHandler,
    getInsightsHandler,
    getInsightJobHandler,
    chatHandler
} from '../controllers/aiInsightController.js';

const aiRouter = express.Router();

// POST /api/ai/analyze-jd              — analyze JD text to extract skills
// POST /api/ai/insights/:analysisId    — enqueue Gemini insights (202) or cache hit (200)
// GET  /api/ai/insights/job/:analysisId — poll insight job status (Issue 1)
// POST /api/ai/chat/:analysisId        — candidate-scoped follow-up Q&A

// Static path must come before parameterised path
aiRouter.get('/insights/job/:analysisId',  userAuth, getInsightJobHandler);

aiRouter.post('/analyze-jd',              userAuth, analyzeJdHandler);
aiRouter.post('/insights/:analysisId',    userAuth, getInsightsHandler);
aiRouter.post('/chat/:analysisId',        userAuth, chatHandler);

export default aiRouter;