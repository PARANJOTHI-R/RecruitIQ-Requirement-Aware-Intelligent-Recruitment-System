import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URI });

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

try {
    await pool.query(sql);
    console.log('✅ Schema applied successfully');
    
    // Verify tables exist
    const result = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    `);
    console.log('\nTables in database:');
    result.rows.forEach(r => console.log(' -', r.table_name));
} catch (err) {
    console.error('❌ Schema error:', err.message);
    process.exit(1);
} finally {
    await pool.end();
}
