// scripts/init-db.js
import { query, pool } from "../services/db.js";

const ddl = `
CREATE SCHEMA IF NOT EXISTS linebot;
SET search_path TO linebot, public;

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

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  chat_kind chat_type NOT NULL,
  title TEXT,
  summary TEXT,
  lang TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conv_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  line_message_id TEXT,
  sender_id TEXT,
  sender_role sender_role NOT NULL DEFAULT 'user',
  type message_type NOT NULL DEFAULT 'text',
  content TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_line_message_id
  ON messages (line_message_id) WHERE line_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conv_time ON messages (conv_id, created_at DESC);
`;

(async () => {
  await query(ddl);
  console.log("✅ DB schema ready");
  await pool.end();
})();
