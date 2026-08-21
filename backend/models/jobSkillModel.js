import { pool } from '../config/postgresdb.js';

export const addJobSkill = async ({ jobId, skillName, isRequired }) => {
    const result = await pool.query(
        `INSERT INTO job_skills (job_id, skill_name, is_required)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [jobId, skillName, isRequired !== false]
    );
    return result.rows[0];
};

export const addJobSkillsBatch = async (jobId, skills) => {
    // skills: [{ skillName, isRequired }]
    if (!skills || skills.length === 0) return [];

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const skill of skills) {
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        params.push(jobId, skill.skillName, skill.isRequired !== false);
    }

    const result = await pool.query(
        `INSERT INTO job_skills (job_id, skill_name, is_required)
         VALUES ${values.join(', ')}
         ON CONFLICT (job_id, skill_name) DO NOTHING
         RETURNING *`,
        params
    );
    return result.rows;
};

export const getJobSkills = async (jobId) => {
    const result = await pool.query(
        `SELECT * FROM job_skills
         WHERE job_id = $1
         ORDER BY is_required DESC, skill_name ASC`,
        [jobId]
    );
    return result.rows;
};

export const getJobSkillById = async (jobSkillId) => {
    const result = await pool.query(
        `SELECT * FROM job_skills WHERE job_skill_id = $1`,
        [jobSkillId]
    );
    return result.rows[0] || null;
};

export const deleteJobSkill = async (jobSkillId) => {
    const result = await pool.query(
        `DELETE FROM job_skills WHERE job_skill_id = $1 RETURNING *`,
        [jobSkillId]
    );
    return result.rows[0] || null;
};
