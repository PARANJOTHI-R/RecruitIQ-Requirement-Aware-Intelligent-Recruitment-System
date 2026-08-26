import { pool } from '../config/postgresdb.js';

export const createResume = async ({ recruiterId, originalFilename, storedPath, fileHash }) => {
    const result = await pool.query(
        `INSERT INTO resumes (recruiter_id, original_filename, stored_path, parser_status, file_hash)
         VALUES ($1, $2, $3, 'pending', $4)
         RETURNING *`,
        [recruiterId, originalFilename, storedPath, fileHash]
    );
    return result.rows[0];
};

export const getResumesByRecruiter = async (recruiterId) => {
    const result = await pool.query(
        `SELECT r.*,
            COALESCE(
                (SELECT json_agg(job_id) FROM resume_submissions rs WHERE rs.resume_id = r.resume_id),
                '[]'::json
            ) AS submitted_job_ids
         FROM resumes r
         WHERE r.recruiter_id = $1
         ORDER BY r.uploaded_at DESC`,
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

export const findResumeByHash = async (recruiterId, fileHash) => {
    const result = await pool.query(
        `SELECT * FROM resumes WHERE recruiter_id = $1 AND file_hash = $2`,
        [recruiterId, fileHash]
    );
    return result.rows[0] || null;
};
