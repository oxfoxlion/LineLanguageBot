// scripts/init-db.js
import { query, pool } from "../services/db.js";

const ddl = `
CREATE SCHEMA IF NOT EXISTS linebot;
SET search_path TO linebot, public;

-- === enum types ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='chat_type') THEN
    CREATE TYPE chat_type AS ENUM ('user','group','room');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='message_type') THEN
    CREATE TYPE message_type AS ENUM ('text','image','video','audio','file','sticker','location','unknown');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='sender_role') THEN
    CREATE TYPE sender_role AS ENUM ('user','assistant','system','tool');
  END IF;
END $$;

-- === tables ===
CREATE TABLE IF NOT EXISTS linebot.conversations (
  id TEXT PRIMARY KEY,
  chat_kind chat_type NOT NULL,
  title TEXT,
  summary TEXT,
  lang TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON linebot.conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS linebot.messages (
  id BIGSERIAL PRIMARY KEY,
  conv_id TEXT NOT NULL REFERENCES linebot.conversations(id) ON DELETE CASCADE,
  line_message_id TEXT,
  sender_id TEXT,
  sender_role sender_role NOT NULL DEFAULT 'user',
  type message_type NOT NULL DEFAULT 'text',
  content TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ⚠️ 修正：確保 line_message_id 有真正的唯一約束（非 partial index）
DO $$
BEGIN
  -- 刪掉舊的 partial index（若存在）
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'linebot' AND indexname = 'uq_messages_line_message_id'
  ) THEN
    EXECUTE 'DROP INDEX linebot.uq_messages_line_message_id';
  END IF;

  -- 新增 UNIQUE constraint（若尚未存在）
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_messages_line_message_id'
      AND conrelid = 'linebot.messages'::regclass
  ) THEN
    ALTER TABLE linebot.messages
      ADD CONSTRAINT uq_messages_line_message_id UNIQUE (line_message_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conv_time
  ON linebot.messages (conv_id, created_at DESC);
`;

(async () => {
  await query(ddl);
  console.log("✅ DB schema ready");
  await pool.end();
})();
