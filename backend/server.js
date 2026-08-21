import express from "express"
import cors from "cors"
import 'dotenv/config';
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/postgresdb.js";
import authRouter from "./routes/authRouter.js";
import userRouter from "./routes/userRoutes.js";
import jobRouter from "./routes/jobRoutes.js";
import jobSkillRouter from "./routes/jobSkillRoutes.js";
import resumeRouter from "./routes/resumeRoutes.js";
import submissionRouter from "./routes/submissionRoutes.js";
import screeningRouter from "./routes/screeningRoutes.js";
import aiRouter from "./routes/aiRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

import aiService from "./services/aiService.js";
import { setAiService as setResumeAiService } from "./controllers/resumeController.js";
import { setAiService as setScreeningAiService } from "./controllers/screeningController.js";
import { setAiService as setInsightAiService } from "./controllers/aiInsightController.js";

// Inject AI service into controllers
setResumeAiService(aiService);
setScreeningAiService(aiService);
setInsightAiService(aiService);

const app = express();
const port = process.env.PORT || 4000;

connectDB();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/', (req, res) => res.send("API Working fine"));

// Auth
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

// ATS resources
app.use('/api/jobs', jobRouter);
app.use('/api/jobs/:jobId/skills', jobSkillRouter);
app.use('/api/resumes', resumeRouter);
app.use('/api/submissions', submissionRouter);
app.use('/api/screening', screeningRouter);
app.use('/api/ai', aiRouter);

app.listen(port, () => console.log(`Server started on PORT:${port}`));