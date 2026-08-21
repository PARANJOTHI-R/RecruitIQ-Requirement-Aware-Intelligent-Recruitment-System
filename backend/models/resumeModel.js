import { pool } from '../config/postgresdb.js';

export const createResume = async ({ recruiterId, originalFilename, storedPath }) => {
    const result = await pool.query(
        `INSERT INTO resumes (recruiter_id, original_filename, stored_path, parser_status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [recruiterId, originalFilename, storedPath]
    );
    return result.rows[0];
};

export const getResumesByRecruiter = async (recruiterId) => {
    const result = await pool.query(
        `SELECT * FROM resumes
         WHERE recruiter_id = $1
         ORDER BY uploaded_at DESC`,
        [recruiterId]
    );
    return result.rows;
};

export const getResumeById = async (resumeId) => {
    const result = await pool.query(
        `SELECT * FROM resumes WHERE resume_id = $1`,
        [resumeId]
    );
    return result.rows[0] || null;
};

export const updateResumeParseResult = async (resumeId, { parsedResumeJson, parserStatus, parserMethod }) => {
    const result = await pool.query(
        `UPDATE resumes
         SET parsed_resume_json = $1,
             parser_status      = $2,
             parser_method      = $3
         WHERE resume_id = $4
         RETURNING *`,
        [parsedResumeJson, parserStatus, parserMethod, resumeId]
    );
    return result.rows[0] || null;
};

export const deleteResume = async (resumeId) => {
    const result = await pool.query(
        `DELETE FROM resumes WHERE resume_id = $1 RETURNING *`,
        [resumeId]
    );
    return result.rows[0] || null;
};
