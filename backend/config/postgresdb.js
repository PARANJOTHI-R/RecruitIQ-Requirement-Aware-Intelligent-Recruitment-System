import pg from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({
    path: path.resolve(process.cwd(), "../.env")
});

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.POSTGRES_URI,
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