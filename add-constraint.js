import 'dotenv/config';
import { pool } from './backend/config/postgresdb.js';

async function addConstraint() {
    try {
        await pool.query(`
            ALTER TABLE resumes 
            ADD CONSTRAINT uq_recruiter_file_hash UNIQUE (recruiter_id, file_hash);
        `);
        console.log("Constraint added successfully.");
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        pool.end();
    }
}
addConstraint();
