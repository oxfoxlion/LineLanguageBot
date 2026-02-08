# LineLanguageBot

這是一個共用的後端伺服器（Node.js + Express），主要提供兩個服務：

1. Line/Discord 對話機器人
2. Note Tool 卡片盒筆記工具

系統整合 OpenAI、PostgreSQL 與排程提醒，作為上述兩個服務的共用基礎設施。

## Features

### Service 1: Line/Discord 對話機器人

- `LINE webhook`：接收訊息、保存歷史、回覆 GPT 內容
- `Discord bot`：可在指定情境下回覆，並保存對話上下文
- `Conversation memory`：以 `linebot.conversations` / `linebot.messages` 保存聊天歷史
- `Scheduled reminders`：定時產生提醒文字並推播到指定群組/頻道

### Service 2: Note Tool 卡片盒筆記工具

- `Note Tool Auth`：Email+Password、JWT、TOTP 2FA
- `Note Tool Card API`：卡片新增、查詢、更新、刪除
- `Note Tool Board API`：白板 CRUD、白板卡片位置、白板移除卡片
- `User settings`：開啟方式（modal/sidepanel）、摘要長度等

## Tech Stack

- Runtime: Node.js (ESM)
- Server: Express
- AI: OpenAI API
- Messaging: LINE Messaging API, Discord.js
- DB: PostgreSQL (`pg`)
- Auth/Security: `bcrypt`, `jsonwebtoken`, `otplib`
- Scheduler: `node-cron`

## Project Structure

```text
.
├─ index.js                         # 伺服器入口
├─ line-config.js                   # LINE SDK 設定
├─ routes/
│  ├─ webhook.js                    # LINE webhook
│  ├─ callGPTtime.js                # cron 排程註冊
│  └─ note_tool/
│     ├─ auth_routes.js             # Note Tool auth API
│     ├─ card_routes.js             # Note Tool card API
│     ├─ board_routes.js            # Note Tool board API
│     └─ user_routes.js             # Note Tool user settings API
├─ services/
│  ├─ db.js                         # PostgreSQL 連線池
│  ├─ chatbot/
│  │  ├─ messages.js                # 對話資料存取
│  │  ├─ openai/openai_keep.js      # 上下文對話
│  │  └─ Discord/discordBot.js      # Discord Bot
│  └─ note_tool/
│     ├─ note_tool_user.js          # 使用者資料邏輯
│     ├─ note_tool_card.js          # 卡片資料邏輯
│     └─ note_tool_board.js         # 白板資料邏輯
├─ tools/callGPT.js                 # 手動/排程呼叫 GPT 並推播
├─ scripts/init-db.js               # 建立 schema/table
└─ docs/note_tool_api.md            # Note Tool API 文件
```

## Requirements

- Node.js 18+
- PostgreSQL 14+
- LINE Messaging channel（需要 secret/token）
- OpenAI API Key
- Discord Bot（若要啟用 Discord）

## Environment Variables

在專案根目錄建立 `.env`：

```env
# Server
# 建議後端改用 3001，避免與 Next.js(3000) 衝突
PORT=3001

# Database
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DB_NAME
PGSSLMODE=require

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# JWT
JWT_SECRET=change_me

# LINE
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token

# LINE push targets (依需求填寫)
LINE_SHAO_ID=
LINE_PRAY_ID=
LINE_PRAY_TEAM_ID=
LINE_LILY_SHAO_ID=
LINE_HOUSE_ID=
LINE_CAT_ID=
LINE_FAMILY_ID=

# Discord
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_discord_channel_id

# CORS (前端站點)
CORS_ORIGIN=http://localhost:3000
```

## Quick Start

1. 安裝依賴

```bash
npm install
```

2. 初始化資料庫 schema/table

```bash
npm run initdb
```

3. 啟動服務

```bash
node index.js
```

啟動後預設會在 `http://localhost:3001` 提供服務。

## API Overview

### Health Check

- `GET /` → `OK`

### LINE Webhook

- `POST /webhook`

### Note Tool Auth

- `POST /note_tool/auth/register`
- `POST /note_tool/auth/login`
- `POST /note_tool/auth/2fa/setup` (需 JWT)
- `POST /note_tool/auth/2fa/verify`

### Note Tool Cards

- `GET /note_tool/card/` (需 JWT)
- `POST /note_tool/card/` (需 JWT)
- `PUT /note_tool/card/:cardId` (需 JWT)
- `DELETE /note_tool/card/:cardId` (需 JWT)

### Note Tool Boards

- `GET /note_tool/board/` (需 JWT)
- `POST /note_tool/board/` (需 JWT)
- `GET /note_tool/board/:boardId` (需 JWT)
- `PUT /note_tool/board/:boardId` (需 JWT)
- `DELETE /note_tool/board/:boardId` (需 JWT)
- `POST /note_tool/board/:boardId/cards` (需 JWT)
- `POST /note_tool/board/:boardId/cards/:cardId` (需 JWT)
- `PUT /note_tool/board/:boardId/cards/:cardId` (需 JWT)
- `DELETE /note_tool/board/:boardId/cards/:cardId` (需 JWT)

### Note Tool Card Links

- `note_tool.card_links` 會在卡片儲存時依 @ mentions 更新

### Note Tool User Settings

- `GET /note_tool/user/settings` (需 JWT)
- `PUT /note_tool/user/settings` (需 JWT)

更多 API payload/response 範例請看 `docs/note_tool_api.md`。

## Database

執行 `npm run initdb` 會建立：

- Schema: `linebot`, `note_tool`
- `linebot` 相關表：`conversations`, `messages`
- `note_tool` 相關表：`users`, `cards`, `card_links`, `boards`, `board_cards`

## Scripts

- `node index.js`：直接啟動伺服器
- `npm run dev`：啟動伺服器（等同 `node index.js`）
- `npm run start`：啟動伺服器（等同 `node index.js`）
- `npm run initdb`：初始化資料庫

## Notes

- `routes/callGPTtime.js` 匯入即註冊排程任務，請確認 `.env` 中推播目標 ID 正確。
- LINE webhook route 會先回 `200`，再非同步處理事件，避免 LINE 重送。
- 若部署到雲端，請確認平台有設定所有必要環境變數。
- Note Tool API 詳細 payload/response 請看 `docs/note_tool_api.md`。
- Work log: `docs/work_log_2026-02-08.md`

## TODO

1. 白板刪除功能
2. 卡片列表與白板內的摘要改為顯示 Markdown 編譯後的內容

## Deployment (Render)

1. 在 Render 建立 `Web Service` 並連接此 repository。
2. 設定 Build Command：`npm install`
3. 設定 Start Command：`node index.js`
4. 在 Render 的 Environment Variables 填入 README 的 `.env` 變數（至少 `DATABASE_URL`、`OPENAI_API_KEY`、LINE 相關 key）。
5. 首次部署前，先在本機或 Render shell 執行：

```bash
npm run initdb
```

6. 部署完成後，將 LINE Webhook URL 設為：
   - `https://<your-render-domain>/webhook`

### Render Checklist

- `GET /` 可回 `OK`
- LINE Developers 後台 Webhook 驗證成功
- 若有用 Discord，`DISCORD_TOKEN` 與 `DISCORD_CHANNEL_ID` 已設定

## License

ISC
