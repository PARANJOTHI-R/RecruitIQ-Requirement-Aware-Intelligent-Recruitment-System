import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
    findRecruiterByEmail,
    findRecruiterById,
    createRecruiter,
    updateVerificationOtp,
    verifyRecruiterAccount,
    updateResetOtp,
    updatePassword
} from '../models/recruiterModel.js';
import transporter from '../config/nodeMailer.js';

export const register = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.json({ success: false, message: 'Missing details' });
    }

    try {
        const existingRecruiter = await findRecruiterByEmail(email);
        if (existingRecruiter) {
            return res.json({ success: false, message: "Recruiter already exist" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const recruiter = await createRecruiter({
            name,
            email,
            passwordHash: hashedPassword
        });

        const token = jwt.sign(
            { id: recruiter.recruiter_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Respond immediately — email is fire-and-forget (Issue 4)
        res.json({ success: true });

        transporter.sendMail({
            from: process.env.SENDER_EMAIL,
            to: email,
            subject: 'Welcome to RecruiteIQ',
            text: `Welcome to RecruiteIQ website. Your account has been created with email id: ${email}`
        }).catch(err => console.error('[mailer] send failed:', { to: email, subject: 'Welcome to RecruiteIQ', error: err.message }));

        return;

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.json({ success: false, message: 'Email and Password are required' });
    }

    // --- Stage timing instrumentation (identifies cold/warm login bottleneck) ---
    const t0 = Date.now();

    try {
        // Stage 1: DB query
        const recruiter = await findRecruiterByEmail(email);
        const t1 = Date.now();

        if (!recruiter) {
            console.info('[login-timing] DB=%dms (no user found) total=%dms', t1 - t0, t1 - t0);
            return res.json({ success: false, message: 'Invalid email' });
        }

        // Stage 2: bcrypt comparison (CPU-bound)
        const isMatch = await bcrypt.compare(password, recruiter.password_hash);
        const t2 = Date.now();

        if (!isMatch) {
            console.info('[login-timing] DB=%dms bcrypt=%dms total=%dms', t1 - t0, t2 - t1, t2 - t0);
            return res.json({ success: false, message: 'Incorrect Password' });
        }

        // Stage 3: JWT sign (synchronous, should be <5 ms)
        const jwtStart = Date.now();
        const token = jwt.sign(
            { id: recruiter.recruiter_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        const t3 = Date.now();

        console.info('[login-timing] DB=%dms bcrypt=%dms jwt=%dms total=%dms',
            t1 - t0, t2 - t1, t3 - jwtStart, t3 - t0);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({ success: true });

    } catch (error) {
        const tErr = Date.now();
        console.error('[login-timing] error after %dms: %s', tErr - t0, error.message);
        return res.json({ success: false, message: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        });

        return res.json({ success: true, message: 'Logged out' });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const sendVerifyOtp = async (req, res) => {
    try {
        const userId = req.userId;
        const recruiter = await findRecruiterById(userId);

        if (!recruiter) {
            return res.json({ success: false, message: "Recruiter not found" });
        }

        if (recruiter.is_acc_verified) {
            return res.json({ success: false, message: "Account Already verified" });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await updateVerificationOtp(recruiter.recruiter_id, otp, expiresAt);

        // Respond immediately — email is fire-and-forget (Issue 4)
        res.json({ success: true, message: 'Verification Otp sent to Your Email' });

        transporter.sendMail({
            from: process.env.SENDER_EMAIL,
            to: recruiter.email,
            subject: 'Account verification Otp',
            text: `Your otp is ${otp}. Verify your account using this Otp.`
        }).catch(err => console.error('[mailer] send failed:', { to: recruiter.email, subject: 'Account verification Otp', error: err.message }));

        return;

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const verifyEmail = async (req, res) => {
    const { otp } = req.body;
    const userId = req.userId;

    if (!userId || !otp) {
        return res.json({ success: false, message: 'Missing details' });
    }

    try {
        const recruiter = await findRecruiterById(userId);

        if (!recruiter) {
            return res.json({ success: false, message: 'Recruiter not Found' });
        }

        if (!recruiter.verify_otp || recruiter.verify_otp !== otp) {
            return res.json({ success: false, message: 'Invalid Otp' });
        }

        if (new Date(recruiter.verify_otp_expire) < new Date()) {
            return res.json({ success: false, message: 'Otp Expired' });
        }

        await verifyRecruiterAccount(recruiter.recruiter_id);

        return res.json({ success: true, message: 'Email verified successfully' });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const isAuthenticated = async (req, res) => {
    try {
        return res.json({ success: true });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const sendResetOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ success: false, message: "Email is required" });
    }

    try {
        const recruiter = await findRecruiterByEmail(email);

        if (!recruiter) {
            return res.json({ success: false, message: "Recruiter does not exist" });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await updateResetOtp(recruiter.recruiter_id, otp, expiresAt);

        // Respond immediately — email is fire-and-forget (Issue 4)
        res.json({ success: true, message: 'Otp sent to your mail' });

        transporter.sendMail({
            from: process.env.SENDER_EMAIL,
            to: recruiter.email,
            subject: 'Password reset Otp',
            text: `Your otp is ${otp}. Reset your account Password using this Otp.`
        }).catch(err => console.error('[mailer] send failed:', { to: recruiter.email, subject: 'Password reset Otp', error: err.message }));

        return;

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const resetPass = async (req, res) => {
    const { otp, email, newPass } = req.body;

    if (!email || !otp || !newPass) {
        return res.json({ success: false, message: "Email otp and new password are required" });
    }

    try {
        const recruiter = await findRecruiterByEmail(email);

        if (!recruiter) {
            return res.json({ success: false, message: "Recruiter not found" });
        }

        if (!recruiter.reset_otp || recruiter.reset_otp !== otp) {
            return res.json({ success: false, message: "Invalid Otp" });
        }

        if (new Date(recruiter.reset_otp_expire) < new Date()) {
            return res.json({ success: false, message: "Otp Expired" });
        }

        const hashedPassword = await bcrypt.hash(newPass, 10);

        await updatePassword(recruiter.recruiter_id, hashedPassword);

        return res.json({
            success: true,
            message: "Password have been reseted successfully"
        });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};