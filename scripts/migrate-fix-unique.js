// scripts/migrate-fix-unique.js
import { query, pool } from "../services/db.js";

const sql = `
DROP INDEX IF EXISTS linebot.uq_messages_line_message_id;
ALTER TABLE linebot.messages
  ADD CONSTRAINT uq_messages_line_message_id UNIQUE (line_message_id);
`;

(async () => {
  try {
    await query(sql);
    console.log("✅ fixed unique constraint on messages.line_message_id");
  } catch (e) {
    console.error("❌ migration failed:", e);
  } finally {
    await pool.end();
  }
})();
