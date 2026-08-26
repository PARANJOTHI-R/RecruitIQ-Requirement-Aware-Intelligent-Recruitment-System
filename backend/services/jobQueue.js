/**
 * jobQueue.js — In-process async job store for RecruitIQ.
 *
 * Design constraints:
 *  - Single-process only. If you scale to multiple Node instances (PM2 cluster,
 *    multiple dynos/containers), replace this Map with Redis (hset/hget) and the
 *    concurrency semaphore with a Redis-backed queue (BullMQ/etc). The interface
 *    (enqueue, getJob, hasJob, generateBatchId) stays the same.
 *  - Natural DB identifiers (submissionId, analysisId) are used as keys for single
 *    jobs so poll endpoints can fall back to the DB if the server restarts.
 *  - Batch jobs use random UUIDs (no natural DB key); accepted trade-off.
 *  - TTL eviction: completed/failed jobs older than 10 min are removed every 5 min.
 *    In-flight (pending/processing) jobs are never evicted.
 */

import crypto from 'crypto';

const CONCURRENCY_LIMIT = 4;
const TTL_MS        = 10 * 60 * 1000; // 10 min after completion — completed jobs evicted quickly
const FAILED_TTL_MS = 30 * 60 * 1000; // 30 min after failure — longer window so pollers can still read 'failed'
// LIMITATION: if a failed job is evicted AND the DB transaction rolled back (no partial record),
// a subsequent poll will see 'not_started' instead of 'failed'. This is a known single-process
// trade-off. Eliminating it entirely requires a durable store (Redis) — out of scope per spec.
const EVICT_INTERVAL_MS = 5 * 60 * 1000; // run eviction every 5 minutes

/** @type {Map<string, JobEntry>} */
const jobs = new Map();
let activeWorkers = 0;
const runQueue = []; // [{key, fn}] waiting for a concurrency slot

/**
 * @typedef {{ status: 'pending'|'processing'|'complete'|'failed',
 *             result: any, error: string|null,
 *             createdAt: number, completedAt: number|null, failedAt: number|null }} JobEntry
 */

const runNext = () => {
    if (runQueue.length === 0 || activeWorkers >= CONCURRENCY_LIMIT) return;

    const { key, fn } = runQueue.shift();
    const job = jobs.get(key);
    if (!job) { runNext(); return; } // evicted while waiting in queue

    job.status = 'processing';
    activeWorkers++;

    // Run in next tick so enqueue() returns before work begins
    setImmediate(async () => {
        try {
            const result = await fn();
            const j = jobs.get(key);
            if (j) { j.status = 'complete'; j.result = result; j.completedAt = Date.now(); }
        } catch (err) {
            const j = jobs.get(key);
            if (j) { j.status = 'failed'; j.error = err.message; j.failedAt = Date.now(); }
            console.error(`[jobQueue] job "${key}" failed:`, err.message);
        } finally {
            activeWorkers--;
            runNext();
        }
    });
};

/**
 * Enqueue a job under the given key. Idempotent: if a pending/processing job
 * already exists for this key, the existing key is returned without re-enqueuing.
 *
 * @param {string} key   Natural DB identifier (submissionId / analysisId) or batch UUID
 * @param {() => Promise<any>} fn  Async worker function — must return a serialisable value
 * @returns {string} The key (same as input)
 */
export const enqueue = (key, fn) => {
    const existing = jobs.get(key);
    if (existing && (existing.status === 'pending' || existing.status === 'processing')) {
        return key; // already in-flight — idempotent
    }

    jobs.set(key, {
        status: 'pending',
        result: null,
        error: null,
        createdAt: Date.now(),
        completedAt: null,
        failedAt: null,
    });

    runQueue.push({ key, fn });
    runNext();
    return key;
};

/**
 * Retrieve a job entry by key. Returns null if not found (evicted or never created).
 * @param {string} key
 * @returns {JobEntry|null}
 */
export const getJob = (key) => jobs.get(key) ?? null;

/**
 * Returns true if the job Map currently has an entry for this key.
 * @param {string} key
 * @returns {boolean}
 */
export const hasJob = (key) => jobs.has(key);

/**
 * Generate a random UUID for batch jobs (which have no natural DB key).
 * @returns {string}
 */
export const generateBatchId = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// TTL eviction loop — runs every 5 min; removes completed/failed jobs > 10 min old
// ---------------------------------------------------------------------------
const evict = () => {
    const now = Date.now();
    for (const [key, job] of jobs.entries()) {
        if (job.status === 'complete') {
            const endTime = job.completedAt;
            if (endTime && now - endTime > TTL_MS) {
                jobs.delete(key);
            }
        } else if (job.status === 'failed') {
            // Keep failed jobs for longer so polls can still see 'failed' before falling back to DB
            const endTime = job.failedAt;
            if (endTime && now - endTime > FAILED_TTL_MS) {
                jobs.delete(key);
            }
        }
    }
};

const evictTimer = setInterval(evict, EVICT_INTERVAL_MS);
if (evictTimer.unref) evictTimer.unref(); // allow process to exit naturally
