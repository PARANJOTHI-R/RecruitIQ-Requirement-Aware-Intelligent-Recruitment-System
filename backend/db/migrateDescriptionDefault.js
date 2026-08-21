import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URI });
await pool.query(`ALTER TABLE jobs ALTER COLUMN description SET DEFAULT ''`);
await pool.query(`UPDATE jobs SET description = '' WHERE description IS NULL`);
console.log('✅ Altered description column: default set to empty string');
await pool.end();
