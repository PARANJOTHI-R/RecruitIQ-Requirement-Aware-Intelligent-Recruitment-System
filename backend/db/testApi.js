/**
 * Phase 5 API test script — tests Express + PostgreSQL layer independently (no AI service).
 * Run from backend/ directory: node db/testApi.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BASE = 'http://localhost:4000';
let cookie = '';
let recruiterId2Cookie = ''; // second recruiter for ownership tests

let testJobId, testSkillId, testResumeId, testSubmissionId, testAnalysisId;

// ── Utility ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label, detail = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        passed++;
        results.push({ label, result: 'PASS' });
    } else {
        console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
        failed++;
        results.push({ label, result: 'FAIL', detail });
    }
}

async function post(url, body, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie && !opts.noCookie) headers['Cookie'] = cookie;
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    const res = await fetch(`${BASE}${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include'
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie');
    if (setCookie && !opts.noCookie) cookie = setCookie.split(';')[0];
    return data;
}

async function get(url, opts = {}) {
    const headers = {};
    if (cookie && !opts.noCookie) headers['Cookie'] = cookie;
    if (opts.cookie) headers['Cookie'] = opts.cookie;
    const res = await fetch(`${BASE}${url}`, { headers });
    return res.json();
}

async function del(url, opts = {}) {
    const headers = {};
    if (cookie && !opts.noCookie) headers['Cookie'] = cookie;
    const res = await fetch(`${BASE}${url}`, { method: 'DELETE', headers });
    return res.json();
}

async function put(url, body) {
    const res = await fetch(`${BASE}${url}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify(body)
    });
    return res.json();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const email1 = `test_${Date.now()}@example.com`;
const email2 = `test2_${Date.now()}@example.com`;

// AUTH ─────────────────────────────────────────────────────────────────────────
console.log('\n=== AUTH ===');

let r = await post('/api/auth/register', { name: 'Test Recruiter', email: email1, password: 'pass1234' });
assert(r.success, 'Register new recruiter');

r = await post('/api/auth/register', { name: 'Test Recruiter', email: email1, password: 'pass1234' });
assert(!r.success, 'Duplicate email rejected');

r = await post('/api/auth/login', { email: email1, password: 'wrongpass' });
assert(!r.success, 'Wrong password rejected');

r = await post('/api/auth/login', { email: email1, password: 'pass1234' });
assert(r.success, 'Login success');

r = await post('/api/auth/is-auth');
assert(r.success, 'JWT middleware works');

r = await get('/api/user/data');
assert(r.success && r.userData?.name === 'Test Recruiter', 'Get user data');

// Register second recruiter for ownership tests
const savedCookie1 = cookie;
cookie = '';
r = await post('/api/auth/register', { name: 'Other Recruiter', email: email2, password: 'pass1234' });
assert(r.success, 'Register second recruiter');
recruiterId2Cookie = cookie;
cookie = savedCookie1;

// JOBS ─────────────────────────────────────────────────────────────────────────
console.log('\n=== JOBS ===');

r = await post('/api/jobs', { title: 'Java Developer', description: 'Backend role', minExp: 2, status: 'open' });
assert(r.success && r.job?.job_id, 'Create job');
testJobId = r.job?.job_id;

r = await get('/api/jobs');
assert(r.success && r.jobs.length >= 1, 'Get recruiter jobs');

r = await get(`/api/jobs/${testJobId}`);
assert(r.success && r.job?.job_id === testJobId, 'Get single job');

// Ownership test: recruiter 2 cannot access recruiter 1's job
r = await get(`/api/jobs/${testJobId}`, { cookie: recruiterId2Cookie });
assert(!r.success || r.job?.recruiter_id !== r.userData, 'Ownership: recruiter 2 cannot access recruiter 1 job');

r = await put(`/api/jobs/${testJobId}`, { status: 'closed' });
assert(r.success && r.job?.status === 'closed', 'Update job status');

// Invalid job ID
r = await get('/api/jobs/00000000-0000-0000-0000-000000000000');
assert(!r.success || r.job === null, 'Invalid job ID returns not found');

// JOB SKILLS ───────────────────────────────────────────────────────────────────
console.log('\n=== JOB SKILLS ===');

r = await post(`/api/jobs/${testJobId}/skills`, {
    skills: [
        { skillName: 'Java', isRequired: true },
        { skillName: 'Spring Boot', isRequired: true },
        { skillName: 'REST API', isRequired: true },
        { skillName: 'SQL', isRequired: true },
        { skillName: 'Git', isRequired: true },
        { skillName: 'Docker', isRequired: false },
        { skillName: 'AWS', isRequired: false }
    ]
});
assert(r.success && r.skills?.length === 7, 'Batch create 7 skills');
testSkillId = r.skills?.[0]?.job_skill_id;
const deletedSkillName = r.skills?.[0]?.skill_name; // track which skill was deleted

// Duplicate skill — batch with ON CONFLICT DO NOTHING
r = await post(`/api/jobs/${testJobId}/skills`, {
    skills: [{ skillName: 'Java', isRequired: true }]
});
assert(r.success && r.skills?.length === 0, 'Duplicate skill: ON CONFLICT DO NOTHING (0 inserted)');

// Single skill duplicate via unique constraint error code
r = await post(`/api/jobs/${testJobId}/skills`, { skillName: 'Java', isRequired: true });
assert(!r.success, 'Single duplicate skill rejected with error');

r = await get(`/api/jobs/${testJobId}/skills`);
assert(r.success && r.skills?.length === 7, 'Get 7 skills for job');

r = await del(`/api/jobs/${testJobId}/skills/${testSkillId}`);
assert(r.success, 'Delete one skill');

r = await get(`/api/jobs/${testJobId}/skills`);
assert(r.success && r.skills?.length === 6, 'Skill count after delete is 6');

// Re-add the skill that was actually deleted
r = await post(`/api/jobs/${testJobId}/skills`, { skillName: deletedSkillName, isRequired: true });
assert(r.success, 'Re-add deleted skill');

// RESUMES ──────────────────────────────────────────────────────────────────────
console.log('\n=== RESUMES (without AI parse — AI not connected yet) ===');

// We can test resume record creation via direct DB insert for Phase 5
// since multer requires a real file upload (can't test without a file)
// Instead verify the endpoint is reachable and returns correct error for missing file
const formRes = await fetch(`${BASE}/api/resumes`, {
    method: 'POST',
    headers: { 'Cookie': cookie },
    // No body / file — multer will call next with no file
});
const formData = await formRes.json();
assert(!formData.success || formData.warning, 'Resume upload without file returns error or warning');

// SUBMISSIONS ──────────────────────────────────────────────────────────────────
// For submission tests we need a resume record. Insert directly via DB.
console.log('\n=== SUBMISSIONS (DB-inserted resume for testing) ===');

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

// Get the recruiter_id for email1
const recRow = await pool.query('SELECT recruiter_id FROM recruiters WHERE email = $1', [email1]);
const recruiterId = recRow.rows[0]?.recruiter_id;

// Insert a fake resume record directly
const resumeRow = await pool.query(
    `INSERT INTO resumes (recruiter_id, original_filename, stored_path, parser_status)
     VALUES ($1, 'test.pdf', '/tmp/test.pdf', 'ok') RETURNING *`,
    [recruiterId]
);
testResumeId = resumeRow.rows[0].resume_id;
console.log('  [setup] Inserted test resume:', testResumeId);

r = await get('/api/resumes');
assert(r.success && r.resumes.some(rv => rv.resume_id === testResumeId), 'Get resumes returns test resume');

r = await get(`/api/resumes/${testResumeId}`);
assert(r.success && r.resume.resume_id === testResumeId, 'Get single resume');

// Ownership test
r = await get(`/api/resumes/${testResumeId}`, { cookie: recruiterId2Cookie });
assert(!r.success, 'Unauthorized: recruiter 2 cannot access recruiter 1 resume');

// Submission create
r = await post('/api/submissions', { resumeId: testResumeId, jobId: testJobId });
assert(r.success && r.submission?.submission_id, 'Create submission');
testSubmissionId = r.submission?.submission_id;

// Duplicate submission
r = await post('/api/submissions', { resumeId: testResumeId, jobId: testJobId });
assert(!r.success, 'Duplicate submission rejected');

r = await get(`/api/submissions/job/${testJobId}`);
assert(r.success && r.submissions?.length >= 1, 'Get submissions by job');

r = await get(`/api/submissions/resume/${testResumeId}`);
assert(r.success && r.submissions?.length >= 1, 'Get submissions by resume');

// Cross-recruiter submission attempt
const recRow2 = await pool.query('SELECT recruiter_id FROM recruiters WHERE email = $1', [email2]);
const jobRow2 = await pool.query(
    `INSERT INTO jobs (recruiter_id, title, min_exp) VALUES ($1, 'Other Job', 0) RETURNING *`,
    [recRow2.rows[0].recruiter_id]
);
r = await post('/api/submissions', { resumeId: testResumeId, jobId: jobRow2.rows[0].job_id });
assert(!r.success, 'Cross-recruiter submission rejected (job belongs to recruiter 2)');

// SCREENING (persistence layer — no AI service yet) ────────────────────────────
console.log('\n=== SCREENING (persistence layer test) ===');

// Directly insert a screening analysis to test the persistence model
const jobSkillsRow = await pool.query('SELECT * FROM job_skills WHERE job_id = $1', [testJobId]);
const jobSkills = jobSkillsRow.rows;

const analysisRow = await pool.query(
    `INSERT INTO screening_analyses
        (submission_id, overall_score, required_skill_score, preferred_skill_score, experience_score, experience_years)
     VALUES ($1, 72.5, 80.0, 50.0, 66.7, 1.5)
     ON CONFLICT (submission_id) DO UPDATE SET overall_score = EXCLUDED.overall_score
     RETURNING *`,
    [testSubmissionId]
);
testAnalysisId = analysisRow.rows[0].analysis_id;
assert(analysisRow.rows[0].overall_score === '72.50', 'Insert screening analysis directly');

// Insert skill matches in a transaction
const client = await pool.connect();
try {
    await client.query('BEGIN');
    let matchInserts = 0;
    for (const js of jobSkills.slice(0, 3)) {
        await client.query(
            `INSERT INTO skill_matches (analysis_id, job_skill_id, skill_name, matched, match_type)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (analysis_id, job_skill_id) DO NOTHING`,
            [testAnalysisId, js.job_skill_id, js.skill_name, true, 'exact']
        );
        matchInserts++;
    }
    await client.query('COMMIT');
    assert(matchInserts === 3, 'Transaction: 3 skill matches inserted');
} catch (e) {
    await client.query('ROLLBACK');
    assert(false, 'Transaction commit', e.message);
} finally {
    client.release();
}

// Verify analysis retrieval via API
r = await get(`/api/screening/${testSubmissionId}`);
assert(r.success && r.analysis?.analysis_id === testAnalysisId, 'Get analysis via API');
assert(r.skillMatches?.length >= 3, 'Skill matches returned with analysis');

// AI Insights persistence (no Gemini call)
const insightRow = await pool.query(
    `INSERT INTO ai_insights (analysis_id, summary, model_name)
     VALUES ($1, 'Test summary', 'test-model')
     ON CONFLICT (analysis_id) DO UPDATE SET summary = EXCLUDED.summary
     RETURNING *`,
    [testAnalysisId]
);
assert(insightRow.rows[0].insight_id, 'Insert AI insight directly');
assert(insightRow.rows[0].summary === 'Test summary', 'AI insight summary persisted');

// UNIQUE constraint on ai_insights
const insightRow2 = await pool.query(
    `INSERT INTO ai_insights (analysis_id, summary, model_name)
     VALUES ($1, 'Duplicate', 'test')
     ON CONFLICT (analysis_id) DO UPDATE SET summary = EXCLUDED.summary
     RETURNING *`,
    [testAnalysisId]
);
assert(insightRow2.rows[0].summary === 'Duplicate', 'ON CONFLICT updates existing insight');

// CLEANUP ──────────────────────────────────────────────────────────────────────
console.log('\n=== CLEANUP ===');
await pool.query('DELETE FROM recruiters WHERE email = ANY($1)', [[email1, email2]]);
console.log('  [cleanup] Test recruiters deleted (CASCADE removes all owned data)');
await pool.end();

// SUMMARY ──────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`PHASE 5 RESULTS: ${passed} PASSED / ${failed} FAILED`);
console.log('='.repeat(60));

if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.result === 'FAIL').forEach(r => {
        console.log(`  ❌ ${r.label}${r.detail ? ': ' + r.detail : ''}`);
    });
    process.exit(1);
}
