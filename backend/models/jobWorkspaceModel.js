import { pool } from '../config/postgresdb.js';

export const getWorkspaceAggregate = async (jobId, limit = 100, offset = 0) => {
    // 1. Get the job and total count
    const jobQuery = await pool.query(
        `SELECT * FROM jobs WHERE job_id = $1`,
        [jobId]
    );
    if (jobQuery.rows.length === 0) return null;
    const job = jobQuery.rows[0];

    const countQuery = await pool.query(
        `SELECT COUNT(*) as total FROM resume_submissions WHERE job_id = $1`,
        [jobId]
    );
    const total = parseInt(countQuery.rows[0].total, 10);

    // 2. Get the skills
    const skillsQuery = await pool.query(
        `SELECT * FROM job_skills WHERE job_id = $1 ORDER BY created_at ASC`,
        [jobId]
    );

    // 3. Get bounded submissions with:
    //    - Candidate contact fields extracted in SQL from parsed_resume_json (avoids shipping
    //      the full JSONB blob over the wire for every row — the leaderboard only needs these 5 fields)
    //    - skill_matches aggregated per analysis
    const submissionsQuery = await pool.query(
        `SELECT
            rs.submission_id,
            rs.resume_id,
            rs.submitted_at,
            r.original_filename,
            r.parser_status,
            r.parser_method,
            -- Contact fields extracted in SQL; avoids fetching the full parsed_resume_json blob
            COALESCE(r.parsed_resume_json #>> '{personal,name}',  r.parsed_resume_json #>> '{contact,name}')     AS candidate_name,
            COALESCE(r.parsed_resume_json #>> '{personal,email}', r.parsed_resume_json #>> '{contact,email}')    AS candidate_email,
            COALESCE(r.parsed_resume_json #>> '{personal,phone}', r.parsed_resume_json #>> '{contact,phone}')    AS candidate_phone,
            COALESCE(r.parsed_resume_json #>> '{personal,linkedin}', r.parsed_resume_json #>> '{contact,linkedin}') AS candidate_linkedin,
            COALESCE(r.parsed_resume_json #>> '{personal,github}', r.parsed_resume_json #>> '{contact,github}')  AS candidate_github,
            sa.analysis_id,
            sa.overall_score,
            sa.required_skill_score,
            sa.preferred_skill_score,
            sa.experience_score,
            sa.education_score,
            sa.semantic_role_score,
            sa.evidence_coverage_score,
            sa.experience_years,
            sa.experience_status,
            (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'skill_name', sm.skill_name,
                        'matched', sm.matched,
                        'match_type', sm.match_type,
                        'similarity_score', sm.similarity_score,
                        'evidence', sm.evidence
                    )
                ), '[]'::json)
                FROM skill_matches sm
                WHERE sm.analysis_id = sa.analysis_id
            ) AS skill_matches
         FROM resume_submissions rs
         JOIN resumes r ON r.resume_id = rs.resume_id
         LEFT JOIN screening_analyses sa ON sa.submission_id = rs.submission_id
         WHERE rs.job_id = $1
         ORDER BY sa.overall_score DESC NULLS LAST, rs.submitted_at DESC
         LIMIT $2 OFFSET $3`,
        [jobId, limit, offset]
    );

    return {
        job,
        skills: skillsQuery.rows,
        submissions: submissionsQuery.rows,
        pagination: {
            limit,
            offset,
            total,
            has_more: offset + limit < total
        }
    };
};