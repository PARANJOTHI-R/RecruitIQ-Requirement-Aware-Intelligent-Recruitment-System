import { pool } from '../config/postgresdb.js';

// createAnalysis uses a transaction CLIENT (not the pool directly).
// The client is passed in from the screening controller's transaction block.
export const createAnalysis = async (client, { submissionId, scoreResult, candidateYears }) => {
    const result = await client.query(
        `INSERT INTO screening_analyses
            (submission_id, overall_score, required_skill_score, preferred_skill_score,
             experience_score, experience_years, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (submission_id)
         DO UPDATE SET
             overall_score        = EXCLUDED.overall_score,
             required_skill_score = EXCLUDED.required_skill_score,
             preferred_skill_score= EXCLUDED.preferred_skill_score,
             experience_score     = EXCLUDED.experience_score,
             experience_years     = EXCLUDED.experience_years,
             processed_at         = NOW()
         RETURNING *`,
        [
            submissionId,
            scoreResult.overall_score,
            scoreResult.required_skill_fit,
            scoreResult.preferred_skill_fit,
            scoreResult.experience_fit,
            candidateYears
        ]
    );
    return result.rows[0];
};

export const getAnalysisBySubmission = async (submissionId) => {
    const result = await pool.query(
        `SELECT * FROM screening_analyses WHERE submission_id = $1`,
        [submissionId]
    );
    return result.rows[0] || null;
};

export const getAnalysisById = async (analysisId) => {
    const result = await pool.query(
        `SELECT * FROM screening_analyses WHERE analysis_id = $1`,
        [analysisId]
    );
    return result.rows[0] || null;
};
