// services/messages.js
import { query } from "./db.js";

export function makeConvId(source) {
  if (source.type === "user") return `user:${source.userId}`;
  if (source.type === "group") return `group:${source.groupId}`;
  if (source.type === "room")  return `room:${source.roomId}`;
  return "unknown:unknown";
}

// 確保 conversations 存在
export async function ensureConversation(convId, kind, title = null) {
  await query(
    `INSERT INTO linebot.conversations (id, chat_kind, title)
     VALUES ($1,$2,$3)
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
    [convId, kind, title]
  );
}

export async function insertUserMessage({ convId, lineMessageId, senderId, type="text", content=null, payload={} }) {
  const { rows } = await query(
    `INSERT INTO linebot.messages
     (conv_id, line_message_id, sender_id, sender_role, type, content, payload)
     VALUES ($1,$2,$3,'user',$4,$5,$6)
     ON CONFLICT (line_message_id) DO NOTHING
     RETURNING *`,
    [convId, lineMessageId, senderId, type, content, payload]
  );
  return rows[0] ?? null;
}

export async function insertAssistantMessage({ convId, content }) {
  const { rows } = await query(
    `INSERT INTO linebot.messages
     (conv_id, sender_role, type, content)
     VALUES ($1,'assistant','text',$2)
     RETURNING *`,
    [convId, content]
  );
  return rows[0];
}

export async function getRecentMessages(convId, limit = 12) {
  const { rows } = await query(
    `SELECT sender_role AS role, content
     FROM linebot.messages
     WHERE conv_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [convId, limit]
  );
  return rows.reverse(); // 舊→新給 GPT
}
