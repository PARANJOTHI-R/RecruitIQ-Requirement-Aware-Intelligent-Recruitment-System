import { pool } from '../config/postgresdb.js';

export const createOrUpdateInsight = async (analysisId, { insightData, modelName }) => {
    const result = await pool.query(
        `INSERT INTO ai_insights
            (analysis_id, summary, strengths, weaknesses, gaps,
             experience_relevance, concerns, interview_focus,
             match_quality_explanation, model_name, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (analysis_id) DO UPDATE SET
             summary                   = EXCLUDED.summary,
             strengths                 = EXCLUDED.strengths,
             weaknesses                = EXCLUDED.weaknesses,
             gaps                      = EXCLUDED.gaps,
             experience_relevance      = EXCLUDED.experience_relevance,
             concerns                  = EXCLUDED.concerns,
             interview_focus           = EXCLUDED.interview_focus,
             match_quality_explanation = EXCLUDED.match_quality_explanation,
             model_name                = EXCLUDED.model_name,
             generated_at              = NOW()
         RETURNING *`,
        [
            analysisId,
            insightData.candidate_summary || null,
            JSON.stringify(insightData.key_strengths || []),
            JSON.stringify(insightData.skill_gaps || []),       // weaknesses mapped from skill_gaps
            JSON.stringify(insightData.skill_gaps || []),       // gaps
            insightData.experience_relevance || null,
            JSON.stringify(insightData.potential_concerns || []),
            JSON.stringify(insightData.interview_focus_areas || []),
            insightData.match_quality_explanation || null,
            modelName || null
        ]
    );
    return result.rows[0];
};

export const getInsightByAnalysis = async (analysisId) => {
    const result = await pool.query(
        `SELECT * FROM ai_insights WHERE analysis_id = $1`,
        [analysisId]
    );
    return result.rows[0] || null;
};
