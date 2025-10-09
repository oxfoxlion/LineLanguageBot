// services/db.js
import 'dotenv/config';   // ← add this line
import pg from "pg";
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
});

export async function query(sql, params = []) {
  const c = await pool.connect();
  try { return await c.query(sql, params); }
  finally { c.release(); }
}
