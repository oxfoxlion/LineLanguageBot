import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { makeConvId, ensureConversation, insertUserMessage, insertAssistantMessage, getRecentMessages } from "../services/messages.js";
// import { askChatGPT } from '../services/openai.js'; //單次對話
import { chatWithOpenAI } from "../services/openai_keep.js"; //接續上下文

const router = express.Router();

// 單次對話
// router.post('/', lineMiddleware, async (req, res) => {
//     try {
//         const events = req.body.events;

//         for (const event of events) {

//             if (event.type === 'message' && event.message.type === 'text') {
//                 const userId = event.source.userId;
//                 const userText = event.message.text;

//                 if (!userId) continue;

//                 // 呼叫 GPT
//                 const gptReply = await askChatGPT(userText);

//                 await lineClient.replyMessage({
//                     replyToken: event.replyToken,
//                     messages: [
//                         {
//                             type: 'text',
//                             text: gptReply.slice(0, 1000)
//                         }
//                     ]
//                 });

//             }
//         }

//         res.status(200).json({ status: 'ok' });

//     } catch (error) {
//         console.error('[Webhook Error]', error);
//         // 就算有錯也回傳 200，避免 LINE 認為你掛掉
//         res.status(200).json({ status: 'error', message: error.message });
//     }
// });

// 可接續上下文
router.post("/", lineMiddleware, async (req, res) => {
  const events = req.body?.events ?? [];
  res.sendStatus(200); // 先回 200，避免 LINE 重送

  for (const ev of events) {
    try {
      if (ev.type !== "message" || ev.message.type !== "text") continue;

      const convId = makeConvId(ev.source);
      const chatKind = ev.source.type; // 'user' | 'group' | 'room'
      await ensureConversation(convId, chatKind);

      // 寫入使用者訊息（用 message.id 去重）
      await insertUserMessage({
        convId,
        lineMessageId: ev.message.id,
        senderId: ev.source.userId ?? null,
        type: "text",
        content: ev.message.text,
        payload: { raw: { type: ev.type, source: ev.source } }
      });

      // 取近期上下文 + 本次訊息，丟 GPT
      const history = await getRecentMessages(convId, 12);
      const reply = await chatWithOpenAI(history);

      // 寫入助理訊息
      await insertAssistantMessage({ convId, content: reply });

      // 回覆
      await lineClient.replyMessage({
        replyToken: ev.replyToken,
        messages: [{ type: "text", text: reply }]
      });
    } catch (err) {
      console.error("Webhook error:", err);
    }
  }
});

export default router;