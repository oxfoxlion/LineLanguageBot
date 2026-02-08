// scripts/init-db.js
import { query, pool } from "../services/db.js";

const ddl = `
CREATE SCHEMA IF NOT EXISTS linebot;
CREATE SCHEMA IF NOT EXISTS note_tool;
SET search_path TO linebot, note_tool,public;

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

-- === linebot ===
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

-- ✅ 修正 UNIQUE constraint 建立邏輯
DO $$
BEGIN
  -- 如果還沒有 constraint，才進行修復
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_messages_line_message_id'
      AND conrelid = 'linebot.messages'::regclass
  ) THEN
    -- 若存在舊的 partial index，就先刪掉
    IF EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'linebot'
        AND indexname = 'uq_messages_line_message_id'
    ) THEN
      EXECUTE 'DROP INDEX linebot.uq_messages_line_message_id';
    END IF;

    -- 建立真正的 UNIQUE constraint
    ALTER TABLE linebot.messages
      ADD CONSTRAINT uq_messages_line_message_id UNIQUE (line_message_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_conv_time
  ON linebot.messages (conv_id, created_at DESC);


-- === note_tool ===
-- === 1. 使用者表 (網站與筆記系統共用) ===
CREATE TABLE IF NOT EXISTS note_tool.users (
  id TEXT PRIMARY KEY,       -- 可存放自定義 ID 或第三方登入 ID
  email TEXT UNIQUE,
  display_name TEXT,
  password_hash TEXT,        -- 存儲雜湊後的密碼
  two_factor_enabled BOOLEAN DEFAULT FALSE, -- 是否啟用 2FA
  two_factor_secret TEXT,                   -- 存放 TOTP 的 Secret 金鑰
  settings JSONB DEFAULT '{}'::jsonb,       -- 使用者設定
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ 補齊既有資料庫缺少的欄位
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='note_tool' AND table_name='users' AND column_name='two_factor_enabled'
  ) THEN
    ALTER TABLE note_tool.users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='note_tool' AND table_name='users' AND column_name='two_factor_secret'
  ) THEN
    ALTER TABLE note_tool.users ADD COLUMN two_factor_secret TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='note_tool' AND table_name='users' AND column_name='settings'
  ) THEN
    ALTER TABLE note_tool.users ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- === 2. 卡片表 (核心內容) ===
CREATE TABLE IF NOT EXISTS note_tool.cards (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES note_tool.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === 3. 卡片關聯表 (網狀連結/雙向連結) ===
CREATE TABLE IF NOT EXISTS note_tool.card_links (
  from_card_id BIGINT REFERENCES note_tool.cards(id) ON DELETE CASCADE,
  to_card_id BIGINT REFERENCES note_tool.cards(id) ON DELETE CASCADE,
  PRIMARY KEY (from_card_id, to_card_id)
);

-- === 4. 白板表 (容器) ===
CREATE TABLE IF NOT EXISTS note_tool.boards (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES note_tool.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === 5. 白板與卡片關聯表 (包含座標佈局) ===
CREATE TABLE IF NOT EXISTS note_tool.board_cards (
  board_id BIGINT REFERENCES note_tool.boards(id) ON DELETE CASCADE,
  card_id BIGINT REFERENCES note_tool.cards(id) ON DELETE CASCADE,
  x_pos INTEGER DEFAULT 0,
  y_pos INTEGER DEFAULT 0,
  PRIMARY KEY (board_id, card_id)
);

-- === 索引優化 ===
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON note_tool.cards(user_id);
CREATE INDEX IF NOT EXISTS idx_boards_user_id ON note_tool.boards(user_id);
`;

(async () => {
  await query(ddl);
  console.log("✅ DB schema ready");
  await pool.end();
})();
