import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();

router.post('/', lineMiddleware, async (req, res) => {
    const events = req.body.events;

    const results = await Promise.all(
        events.map(async (event) => {
            //只處理文字訊息
            if (event.type === 'message' && event.message.type === 'text') {
                const userText = event.message.text;//取得使用者訊息
                const gptReply = await askChatGPT(userText); //執行GPT API 並取得回傳的訊息

                //回傳給Line使用者
                return lineClient.replyMessage(event.replyToken, {
                    type: 'text',
                    text: gptReply,
                });
            } else {
                // 不處理其他類型的事件，但要 return 以防止 undefined
                return Promise.resolve(null);
            };
        })
    );
    console.log(results);
    res.status(200).json({ status: 'ok' });
})

export default router;