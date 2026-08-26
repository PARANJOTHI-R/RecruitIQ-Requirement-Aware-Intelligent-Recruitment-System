import 'dotenv/config';
import { pool } from './backend/config/postgresdb.js';

async function checkIndexes() {
    try {
        const res = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'resumes';
        `);
        console.log("INDEXES:", JSON.stringify(res.rows, null, 2));

        const res2 = await pool.query(`
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'resumes'::regclass;
        `);
        console.log("CONSTRAINTS:", JSON.stringify(res2.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkIndexes();
