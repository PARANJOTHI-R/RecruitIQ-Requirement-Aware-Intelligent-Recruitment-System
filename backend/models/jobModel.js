import { pool } from '../config/postgresdb.js';

export const createJob = async ({ recruiterId, title, description, minExp, reqEdu, status }) => {
    const result = await pool.query(
        `INSERT INTO jobs (recruiter_id, title, description, min_exp, req_edu, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [recruiterId, title, description || null, minExp || 0, reqEdu || null, status || 'draft']
    );
    return result.rows[0];
};

export const getJobsByRecruiter = async (recruiterId) => {
    const result = await pool.query(
        `SELECT * FROM jobs
         WHERE recruiter_id = $1
         ORDER BY created_at DESC`,
        [recruiterId]
    );
    return result.rows;
};

export const getJobById = async (jobId) => {
    const result = await pool.query(
        `SELECT * FROM jobs WHERE job_id = $1`,
        [jobId]
    );
    return result.rows[0] || null;
};

export const updateJob = async (jobId, { title, description, minExp, reqEdu, status }) => {
    const result = await pool.query(
        `UPDATE jobs
         SET title       = COALESCE($1, title),
             description = COALESCE($2, description),
             min_exp     = COALESCE($3, min_exp),
             req_edu     = COALESCE($4, req_edu),
             status      = COALESCE($5, status),
             updated_at  = NOW()
         WHERE job_id = $6
         RETURNING *`,
        [title, description, minExp, reqEdu, status, jobId]
    );
    return result.rows[0] || null;
};

export const deleteJob = async (jobId) => {
    const result = await pool.query(
        `DELETE FROM jobs WHERE job_id = $1 RETURNING *`,
        [jobId]
    );
    return result.rows[0] || null;
};
