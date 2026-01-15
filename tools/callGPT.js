// tools/callGPT.js
import { lineClient } from '../line-config.js';
import {
  makeConvId,
  ensureConversation,
  insertUserMessage,
  insertAssistantMessage,
  getRecentMessages,
} from "../services/messages.js";
import { chatWithOpenAI } from "../services/openai_keep.js";
import sendDiscordMessage from "../services/Discord/discordBot.js"; // 引入 Discord 發送功能

/**
 * 發送 GPT 回覆至指定平台（LINE 或 Discord），包含上下文與資料庫紀錄。
 * @param {string} prompt - 輸入給 GPT 的訊息。
 * @param {object} [opts]
 * @param {string} [opts.groupId] - LINE 群組 ID (預設使用環境變數)。
 * @param {string} [opts.discordChannelId] - Discord 頻道 ID。
 * @param {string} [opts.platform='line'] - 指定平台：'line' 或 'discord'。
 * @param {number} [opts.maxHistory=12] - 包含多少則最近訊息作為上下文。
 * @returns {Promise<{ ok: boolean, reply?: string }>}
 */
export default async function callGPT(prompt, { 
  groupId = process.env.LINE_SHAO_ID, 
  discordChannelId = process.env.DISCORD_CHANNEL_ID,
  platform = "line", 
  maxHistory = 12 
} = {}) {

  // 檢查必要參數
  if (platform === "line" && !groupId) {
    console.error("[callGPT] 缺少 LINE 群組 ID。");
    return { ok: false };
  }
  if (!prompt || typeof prompt !== "string") {
    console.error("[callGPT] 無效的 prompt。");
    return { ok: false };
  }

  try {
    // 1) 根據平台決定 Source 與格式，確保資料庫對話紀錄一致
    let source;
    if (platform === "discord") {
      source = { type: "group", channelId: discordChannelId }; // Discord 頻道視為 group 類型
    } else {
      source = { type: "group", groupId };
    }

    // 建立唯一對話 ID (此處需確保 messages.js 的 makeConvId 能識別 discord 類型)
    // 如果你還沒改 messages.js，這裡先手動處理前綴
    const convId = platform === "discord" ? `discord:${discordChannelId}` : makeConvId(source);
    
    // 2) 確保資料庫中有此對話
    await ensureConversation(convId, "group");

    // 3) 紀錄此筆「系統/手動」發出的 Prompt，使其成為歷史的一部分
    await insertUserMessage({
      convId,
      lineMessageId: null, // 非 LINE 傳入訊息，無 messageId
      senderId: null,
      type: "text",
      content: prompt,
      payload: { raw: { type: "manual", platform, source } },
    });

    // 4) 抓取最近歷史紀錄（包含剛存入的 Prompt）
    const history = await getRecentMessages(convId, maxHistory);

    // 5) 呼叫 GPT 產生回覆
    const reply = await chatWithOpenAI(history);

    // 6) 紀錄機器人的回覆到資料庫
    await insertAssistantMessage({ convId, content: reply });

    // 7) 根據平台推播訊息
    const text = (reply ?? "").slice(0, 1000);

    if (platform === "discord") {
      // 發送到 Discord
      await sendDiscordMessage(text); 
      console.log("[callGPT] ✅ 訊息已推播至 Discord");
    } else {
      // 發送到 LINE
      await lineClient.pushMessage({
        to: groupId,
        messages: [{ type: "text", text }],
      });
      console.log("[callGPT] ✅ 訊息已推播至 LINE");
    }

    return { ok: true, reply: text };
  } catch (err) {
    console.error("[callGPT] ❌ 執行失敗:", err?.response?.data ?? err);
    return { ok: false };
  }
}