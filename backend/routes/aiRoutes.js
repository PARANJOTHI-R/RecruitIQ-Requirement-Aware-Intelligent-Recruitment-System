import express from 'express';
import userAuth from '../middleWare/userAuth.js';
import {
    analyzeJdHandler,
    getInsightsHandler,
    chatHandler
} from '../controllers/aiInsightController.js';

const aiRouter = express.Router();

// POST /api/ai/analyze-jd            — analyze job description text to extract skills
// POST /api/ai/insights/:analysisId  — on-demand Gemini insights (returns cached if exists)
// POST /api/ai/chat/:analysisId      — candidate-scoped follow-up Q&A
aiRouter.post('/analyze-jd',           userAuth, analyzeJdHandler);
aiRouter.post('/insights/:analysisId', userAuth, getInsightsHandler);
aiRouter.post('/chat/:analysisId',     userAuth, chatHandler);

export default aiRouter;
