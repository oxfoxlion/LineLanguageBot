// scripts/test-db-connection.js
import 'dotenv/config';
import { query } from '../services/db.js';

try {
  const r = await query('select now() as now');
  console.log('✅ DB connected. Server time:', r.rows[0].now);
  process.exit(0);
} catch (e) {
  console.error('❌ DB connect failed:', e.message);
  process.exit(1);
}
