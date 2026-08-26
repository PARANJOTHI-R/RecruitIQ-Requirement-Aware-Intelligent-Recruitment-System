import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URI,
    // Neon Serverless tuning:
    //   idleTimeoutMillis: keep connections warm for 30 s so repeated requests
    //     (login, workspace, batch-start) don't pay the Neon compute cold-start
    //     penalty (~1–3 s) after a period of inactivity.
    //   max: cap at 10 to avoid exhausting Neon's connection limit on free/starter plans.
    //   connectionTimeoutMillis: fail fast (5 s) rather than hanging if the pool is saturated.
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const connectDB = async () => {
    try {
        const client = await pool.connect();

        console.log("Database Connected");

        client.release();
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
};

export { pool };
export default connectDB;