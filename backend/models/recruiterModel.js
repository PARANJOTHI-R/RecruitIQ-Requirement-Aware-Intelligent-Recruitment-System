import { pool } from "../config/postgresdb.js";

export const findRecruiterByEmail = async (email) => {
    const result = await pool.query(
        `SELECT * 
         FROM recruiters 
         WHERE email = $1`,
        [email]
    );

    return result.rows[0] || null;
};

export const findRecruiterById = async (recruiterId) => {
    const result = await pool.query(
        `SELECT * 
         FROM recruiters 
         WHERE recruiter_id = $1`,
        [recruiterId]
    );

    return result.rows[0] || null;
};

export const createRecruiter = async ({ name, email, passwordHash }) => {
    const result = await pool.query(
        `INSERT INTO recruiters (
            name,
            email,
            password_hash
        )
        VALUES ($1, $2, $3)
        RETURNING *`,
        [name, email, passwordHash]
    );

    return result.rows[0];
};

export const updateVerificationOtp = async (recruiterId, otp, expiresAt) => {
    const result = await pool.query(
        `UPDATE recruiters
         SET
            verify_otp = $1,
            verify_otp_expire = $2,
            updated_at = NOW()
         WHERE recruiter_id = $3
         RETURNING *`,
        [otp, expiresAt, recruiterId]
    );

    return result.rows[0];
};

export const verifyRecruiterAccount = async (recruiterId) => {
    const result = await pool.query(
        `UPDATE recruiters
         SET
            is_acc_verified = TRUE,
            verify_otp = '',
            verify_otp_expire = NULL,
            updated_at = NOW()
         WHERE recruiter_id = $1
         RETURNING *`,
        [recruiterId]
    );

    return result.rows[0];
};

export const updateResetOtp = async (recruiterId, otp, expiresAt) => {
    const result = await pool.query(
        `UPDATE recruiters
         SET
            reset_otp = $1,
            reset_otp_expire = $2,
            updated_at = NOW()
         WHERE recruiter_id = $3
         RETURNING *`,
        [otp, expiresAt, recruiterId]
    );

    return result.rows[0];
};

export const updatePassword = async (recruiterId, passwordHash) => {
    const result = await pool.query(
        `UPDATE recruiters
         SET
            password_hash = $1,
            reset_otp = '',
            reset_otp_expire = NULL,
            updated_at = NOW()
         WHERE recruiter_id = $2
         RETURNING *`,
        [passwordHash, recruiterId]
    );

    return result.rows[0];
};