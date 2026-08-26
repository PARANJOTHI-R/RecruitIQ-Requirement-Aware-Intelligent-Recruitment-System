-- Migration 001: Performance indexes
-- Safe to re-run (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_rs_job_id ON resume_submissions (job_id);
CREATE INDEX IF NOT EXISTS idx_rs_resume_id ON resume_submissions (resume_id);
CREATE INDEX IF NOT EXISTS idx_sa_submission_id ON screening_analyses (submission_id);
CREATE INDEX IF NOT EXISTS idx_sm_analysis_id ON skill_matches (analysis_id);
CREATE INDEX IF NOT EXISTS idx_js_job_id ON job_skills (job_id);