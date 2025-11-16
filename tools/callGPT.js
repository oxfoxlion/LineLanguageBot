// services/callGPT.js
import { lineClient } from '../line-config.js';
import {
  makeConvId,
  ensureConversation,
  insertUserMessage,
  insertAssistantMessage,
  getRecentMessages,
} from "../services/messages.js";
import { chatWithOpenAI } from "../services/openai_keep.js";

/**
 * Send a one-off GPT reply to a LINE group, with context and DB logging.
 * @param {string} prompt - The message to feed into GPT.
 * @param {object} [opts]
 * @param {string} [opts.groupId=process.env.LINE_GROUP_ID] - Target LINE group ID.
 * @param {number} [opts.maxHistory=12] - How many recent messages to include as context.
 * @returns {Promise<{ ok: boolean, reply?: string }>}
 */
export default async function callGPT(prompt, { groupId = process.env.LINE_SHAO_ID, maxHistory = 12 } = {}) {
  if (!groupId) {
    console.error("[callGPT] Missing LINE group ID. Provide opts.groupId or set LINE_GROUP_ID.");
    return { ok: false };
  }
  if (!prompt || typeof prompt !== "string") {
    console.error("[callGPT] Invalid prompt.");
    return { ok: false };
  }

  try {
    // 1) Ensure conversation exists for this group
    const source = { type: "group", groupId };
    const convId = makeConvId(source);
    await ensureConversation(convId, "group");

    // 2) Record this outgoing "user" message (the prompt) so it’s part of history
    await insertUserMessage({
      convId,
      lineMessageId: null,              // no LINE inbound id (this is manual/one-off)
      senderId: null,                   // unknown/non-LINE user
      type: "text",
      content: prompt,
      payload: { raw: { type: "manual", source } },
    });

    // 3) Pull recent history (now includes the prompt)
    const history = await getRecentMessages(convId, maxHistory);

    // 4) Ask GPT with context
    const reply = await chatWithOpenAI(history);

    // 5) Log assistant reply
    await insertAssistantMessage({ convId, content: reply });

    // 6) Push to LINE group (trim to keep it safe)
    const text = (reply ?? "").slice(0, 1000);
    await lineClient.pushMessage({
      to: groupId,
      messages: [{ type: "text", text }],
    });

    console.log("[callGPT] ✅ Reply pushed to group");
    return { ok: true, reply: text };
  } catch (err) {
    console.error("[callGPT] ❌ Failed:", err?.response?.data ?? err);
    return { ok: false };
  }
}

// callGPT("系統提醒：告訴大家今天是11月18號，今天是李月英女士的農曆生日和綺綺的國曆生日，請大家祝福他們生日快樂。",process.env.LINE_SHAO_ID)