import express from "express";
import rateLimit from "express-rate-limit";
import { isAuthenticated, login, logout, register, resetPass, sendResetOtp, sendVerifyOtp, verifyEmail } from "../controllers/authController.js";
import userAuth from "../middleWare/userAuth.js";

// ---------------------------------------------------------------------------
// Rate limiters (Issue 6)
//
// NOTE: The default store is in-process memory — correct for a single Node
// process. If you add horizontal scaling (PM2 cluster / multiple dynos),
// swap the store for rate-limit-redis to share state across instances.
// ---------------------------------------------------------------------------

// 5 attempts per 15 min per IP — for high-risk endpoints
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again after 15 minutes.' }
});

// 10 attempts per 15 min per IP — for lower-risk authenticated endpoints
const moderateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again after 15 minutes.' }
});

const authRouter = express.Router();

authRouter.post('/register',         strictLimiter,   register);
authRouter.post('/login',            strictLimiter,   login);
authRouter.post('/send-reset-otp',   strictLimiter,   sendResetOtp);
authRouter.post('/send-verify-otp',  userAuth, moderateLimiter, sendVerifyOtp);
authRouter.post('/verify-account',   userAuth, verifyEmail);
authRouter.post('/logout',           logout);
authRouter.post('/is-auth',          userAuth, isAuthenticated);
authRouter.post('/reset-password',   resetPass);

export default authRouter;