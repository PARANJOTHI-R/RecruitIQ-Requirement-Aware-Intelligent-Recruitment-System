-- =============================================================
-- ATS PostgreSQL Schema
-- Target database: Neon PostgreSQL (ATS-DB)
-- Run once to create all tables.
-- Idempotent: CREATE TABLE IF NOT EXISTS throughout.
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- recruiters
-- Combined auth user + ATS recruiter entity.
-- Already partially exists (auth migration done).
-- This CREATE is idempotent; if the table already exists with
-- the auth columns, this will not recreate it.
-- =============================================================
CREATE TABLE IF NOT EXISTS recruiters (
    recruiter_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    company_name        TEXT,
    verify_otp          TEXT DEFAULT '',
    verify_otp_expire   TIMESTAMPTZ,
    is_acc_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    reset_otp           TEXT DEFAULT '',
    reset_otp_expire    TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- jobs
-- =============================================================
CREATE TABLE IF NOT EXISTS jobs (
    job_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id    UUID NOT NULL REFERENCES recruiters(recruiter_id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    min_exp         NUMERIC(4,1) NOT NULL DEFAULT 0,
    req_edu         TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'open', 'closed', 'archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id ON jobs(recruiter_id);

-- =============================================================
-- job_skills
-- =============================================================
CREATE TABLE IF NOT EXISTS job_skills (
    job_skill_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id          UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    skill_name      TEXT NOT NULL,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_job_skill UNIQUE (job_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_job_skills_job_id ON job_skills(job_id);

-- =============================================================
-- resumes
-- parsed_resume_json holds the full dict from process_resume().
-- parser_status: pending | ok | degraded | failed
-- parser_method:  layout | linear_fallback
-- =============================================================
CREATE TABLE IF NOT EXISTS resumes (
    resume_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recruiter_id        UUID NOT NULL REFERENCES recruiters(recruiter_id) ON DELETE CASCADE,
    original_filename   TEXT NOT NULL,
    stored_path         TEXT NOT NULL,
    parsed_resume_json  JSONB,
    parser_status       TEXT NOT NULL DEFAULT 'pending'
                            CHECK (parser_status IN ('pending', 'ok', 'degraded', 'failed')),
    parser_method       TEXT,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    file_hash           TEXT,
    
    CONSTRAINT uq_recruiter_file_hash UNIQUE (recruiter_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_resumes_recruiter_id ON resumes(recruiter_id);

-- =============================================================
-- resume_submissions
-- One record per (resume, job) pairing.
-- =============================================================
CREATE TABLE IF NOT EXISTS resume_submissions (
    submission_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id       UUID NOT NULL REFERENCES resumes(resume_id) ON DELETE CASCADE,
    job_id          UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_resume_job UNIQUE (resume_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_resume_id ON resume_submissions(resume_id);
CREATE INDEX IF NOT EXISTS idx_submissions_job_id    ON resume_submissions(job_id);

-- =============================================================
-- screening_analyses
-- One deterministic result per submission.
-- All score components preserved (not collapsed to overall_score).
-- =============================================================
CREATE TABLE IF NOT EXISTS screening_analyses (
    analysis_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id           UUID NOT NULL REFERENCES resume_submissions(submission_id) ON DELETE CASCADE,
    overall_score           NUMERIC(5,2),
    required_skill_score    NUMERIC(5,2),
    preferred_skill_score   NUMERIC(5,2),
    experience_score        NUMERIC(5,2),
    education_score         NUMERIC(5,2),
    semantic_role_score     NUMERIC(5,2),
    evidence_coverage_score NUMERIC(5,2),
    experience_years        NUMERIC(5,2),
    experience_status       TEXT,
    processed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_analysis_submission UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS idx_analyses_submission_id ON screening_analyses(submission_id);

-- =============================================================
-- skill_matches
-- Per-skill match record linked to an analysis.
-- match_type: exact | normalized | semantic | partial | related | missing
-- =============================================================
CREATE TABLE IF NOT EXISTS skill_matches (
    match_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id     UUID NOT NULL REFERENCES screening_analyses(analysis_id) ON DELETE CASCADE,
    job_skill_id    UUID REFERENCES job_skills(job_skill_id) ON DELETE SET NULL,
    skill_name      TEXT NOT NULL,
    matched         BOOLEAN NOT NULL DEFAULT FALSE,
    match_type      TEXT CHECK (match_type IN ('exact', 'normalized', 'semantic', 'partial', 'related', 'missing')),
    similarity_score NUMERIC(6,4),
    evidence        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_match_analysis_skill UNIQUE (analysis_id, job_skill_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_matches_analysis_id ON skill_matches(analysis_id);

-- =============================================================
-- ai_insights
-- Optional on-demand Gemini result.
-- One per analysis. Missing record ≠ screening failure.
-- Structured JSONB fields for list data.
-- =============================================================
CREATE TABLE IF NOT EXISTS ai_insights (
    insight_id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id                 UUID NOT NULL REFERENCES screening_analyses(analysis_id) ON DELETE CASCADE,
    summary                     TEXT,
    strengths                   JSONB,
    weaknesses                  JSONB,
    gaps                        JSONB,
    experience_relevance        TEXT,
    concerns                    JSONB,
    interview_focus             JSONB,
    match_quality_explanation   TEXT,
    model_name                  TEXT,
    generated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_insight_analysis UNIQUE (analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_analysis_id ON ai_insights(analysis_id);
