import 'dotenv/config';
import { pool } from './backend/config/postgresdb.js';

async function checkDuplicates() {
    try {
        const res = await pool.query(`
            SELECT recruiter_id, file_hash, COUNT(*) 
            FROM resumes 
            WHERE file_hash IS NOT NULL
            GROUP BY recruiter_id, file_hash 
            HAVING COUNT(*) > 1;
        `);
        console.log("DUPLICATES:", JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkDuplicates();
