
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("❌ Error: DATABASE_URL not found in environment variables.");
        process.exit(1);
    }

    const client = new pg.Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } // Required for Supabase in many envs
    });

    try {
        await client.connect();
        console.log("✅ Connected to database.");

        const sqlPath = path.resolve(__dirname, '../supabase/migrations/20250122_add_parlays_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log(`Running migration: ${path.basename(sqlPath)}...`);
        await client.query(sql);

        console.log("✅ Migration applied successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await client.end();
    }
}

migrate();
