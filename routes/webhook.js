import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();


router.post('/', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;

        for (const event of events) {

            if (event.type === 'message' && event.message.type === 'text') {
                // 取得使用者訊息
                const userText = event.message.text;

                try {
                    const gptReply = await askChatGPT(userText);

                    await lineClient.replyMessage({
                        replyToken: event.replyToken,
                        messages: [
                            {
                                type: 'text',
                                text: gptReply.slice(0, 1000) // LINE 限制 1000 字
                            }
                        ]
                    });
                } catch (err) {
                    console.error('❌ GPT 回覆失敗', err);
                }

            }
        }

        res.status(200).json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook Error]', error);
        // 就算有錯也回傳 200，避免 LINE 認為你掛掉
        res.status(200).json({ status: 'error', message: error.message });
    }
});

export default router;