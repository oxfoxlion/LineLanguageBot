import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();


router.post('/', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;

        for (const event of events) {

            if (event.type === 'message' && event.message.type === 'text') {
                const userId = event.source.userId;
                const userText = event.message.text;

                if (!userId) continue;

                // 呼叫 GPT
                const gptReply = await askChatGPT(userText);

                await lineClient.replyMessage({
                    replyToken: event.replyToken,
                    messages: [
                        {
                            type: 'text',
                            text: gptReply.slice(0, 1000)
                        }
                    ]
                });

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