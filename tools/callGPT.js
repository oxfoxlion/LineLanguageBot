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

  // 檢查基本參數
  if (!prompt || typeof prompt !== "string") {
    console.error("[callGPT] 無效的 prompt。");
    return { ok: false };
  }

  try {
    // 1) 根據平台決定 Source
    let source;
    if (platform === "discord") {
      source = { type: "group", channelId: discordChannelId };
    } else {
      source = { type: "group", groupId };
    }

    // 2) 建立唯一對話 ID (使用 platform 區分)
    const convId = makeConvId(source, platform);
    
    // 3) 確保資料庫中有此對話
    await ensureConversation(convId, "group");

    // 4) 紀錄此筆「系統/手動」發出的 Prompt
    await insertUserMessage({
      convId,
      lineMessageId: null,
      senderId: null,
      type: "text",
      content: prompt,
      payload: { raw: { type: "manual", platform, source } },
    });

    // 5) 抓取最近歷史紀錄並呼叫 GPT
    const history = await getRecentMessages(convId, maxHistory);
    const reply = await chatWithOpenAI(history);

    // 6) 紀錄回覆內容
    await insertAssistantMessage({ convId, content: reply });

    const text = (reply ?? "").slice(0, 1000);

    // 7) 根據平台分流推播訊息
    if (platform === "discord") {
      await sendDiscordMessage(text); 
      console.log("[callGPT] ✅ 訊息已推播至 Discord");
      return { ok: true, reply: text }; // ⚠️ 修正：Discord 發送後直接回傳，不執行下方 LINE 邏輯
    } 

    // LINE 平台邏輯
    if (!groupId) {
      console.error("[callGPT] 執行 LINE 推播但缺少有效 groupId");
      return { ok: false };
    }

    await lineClient.pushMessage({
      to: groupId,
      messages: [{ type: "text", text }],
    });
    console.log("[callGPT] ✅ 訊息已推播至 LINE");

    return { ok: true, reply: text };
  } catch (err) {
    console.error("[callGPT] ❌ 執行失敗:", err);
    return { ok: false };
  }
}