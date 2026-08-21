import { pool } from '../config/postgresdb.js';

export const createSubmission = async ({ resumeId, jobId }) => {
    const result = await pool.query(
        `INSERT INTO resume_submissions (resume_id, job_id)
         VALUES ($1, $2)
         RETURNING *`,
        [resumeId, jobId]
    );
    return result.rows[0];
};

export const getSubmissionById = async (submissionId) => {
    const result = await pool.query(
        `SELECT * FROM resume_submissions WHERE submission_id = $1`,
        [submissionId]
    );
    return result.rows[0] || null;
};

export const findSubmission = async (resumeId, jobId) => {
    const result = await pool.query(
        `SELECT * FROM resume_submissions
         WHERE resume_id = $1 AND job_id = $2`,
        [resumeId, jobId]
    );
    return result.rows[0] || null;
};

export const getSubmissionsByJob = async (jobId) => {
    const result = await pool.query(
        `SELECT rs.*, r.original_filename, r.parser_status, r.parser_method
         FROM resume_submissions rs
         JOIN resumes r ON r.resume_id = rs.resume_id
         WHERE rs.job_id = $1
         ORDER BY rs.submitted_at DESC`,
        [jobId]
    );
    return result.rows;
};

export const getSubmissionsByResume = async (resumeId) => {
    const result = await pool.query(
        `SELECT rs.*, j.title AS job_title, j.status AS job_status
         FROM resume_submissions rs
         JOIN jobs j ON j.job_id = rs.job_id
         WHERE rs.resume_id = $1
         ORDER BY rs.submitted_at DESC`,
        [resumeId]
    );
    return result.rows;
};
