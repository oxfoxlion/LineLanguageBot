import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();

router.post('/', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;

        const results = await Promise.all(
            events.map(async (event) => {
                if (event.type === 'message' && event.message.type === 'text') {
                    const userText = event.message.text;

                    return lineClient.replyMessage({
                        replyToken: event.replyToken,
                        messages: [
                            {
                                type: 'text',
                                text: `你說的是：${userText}`
                            }
                        ]
                    })
                } else {
                    // 明確 return null，避免 Promise.all 出現 undefined
                    return Promise.resolve(null);
                }
            })
        );

        res.status(200).json(results);

    } catch (error) {
        console.error('[Webhook Error]', error);
        // 就算有錯也回傳 200，避免 LINE 認為你掛掉
        res.status(200).json({ status: 'error', message: error.message });
    }
});

export default router;