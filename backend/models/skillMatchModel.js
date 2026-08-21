import { pool } from '../config/postgresdb.js';

// insertSkillMatches uses a transaction CLIENT.
// matchRows: [{ analysisId, jobSkillId, skillName, matched, matchType, similarityScore, evidence }]
export const insertSkillMatches = async (client, analysisId, matchRows) => {
    if (!matchRows || matchRows.length === 0) return [];

    const values = [];
    const params = [];
    let idx = 1;

    for (const row of matchRows) {
        values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        params.push(
            analysisId,
            row.jobSkillId || null,
            row.skillName,
            row.matched,
            row.matchType || null,
            row.similarityScore || null,
            row.evidence || null
        );
    }

    const result = await client.query(
        `INSERT INTO skill_matches
            (analysis_id, job_skill_id, skill_name, matched, match_type, similarity_score, evidence)
         VALUES ${values.join(', ')}
         ON CONFLICT (analysis_id, job_skill_id) DO UPDATE SET
             matched          = EXCLUDED.matched,
             match_type       = EXCLUDED.match_type,
             similarity_score = EXCLUDED.similarity_score,
             evidence         = EXCLUDED.evidence
         RETURNING *`,
        params
    );
    return result.rows;
};

export const getMatchesByAnalysis = async (analysisId) => {
    const result = await pool.query(
        `SELECT sm.*, js.is_required
         FROM skill_matches sm
         LEFT JOIN job_skills js ON js.job_skill_id = sm.job_skill_id
         WHERE sm.analysis_id = $1
         ORDER BY js.is_required DESC NULLS LAST, sm.skill_name ASC`,
        [analysisId]
    );
    return result.rows;
};
