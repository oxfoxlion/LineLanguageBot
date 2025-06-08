import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();

router.post('/', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;

        for (const event of events) {

            if (event.type === 'message' && event.message.type === 'text') {
                const source = event.source;
                console.log('[source]', source);

                const userId = source.userId;

                if (!userId) {
                    console.warn('⚠️ 無法取得 userId，來源可能是群組或未加好友');
                    continue; // 或 return
                }

                try {
                    // 取得使用者名稱
                    const profile = await lineClient.getProfile(userId);
                    const name = profile.displayName;

                    //回覆打招呼 + 選單
                    await lineClient.replyMessage(
                        event.replyToken,
                        {
                            type: "text",
                            text: `Hi ${name}！請選擇你今天想練習的模式～`,
                            quickReply: {
                                items: [
                                    {
                                        type: "action",
                                        action: {
                                            type: "message",
                                            label: "🧠 學習模式",
                                            text: "學習模式"
                                        }
                                    },
                                    {
                                        type: "action",
                                        action: {
                                            type: "message",
                                            label: "📝 考題模式",
                                            text: "考題模式"
                                        }
                                    },
                                    {
                                        type: "action",
                                        action: {
                                            type: "message",
                                            label: "💬 對話模式",
                                            text: "對話模式"
                                        }
                                    }
                                ]
                            }
                        }
                    );

                } catch (error) {
                    console.error("抓不到使用者名稱", error)
                }

            }
        }

        // const results = await Promise.all(
        //     events.map(async (event) => {
        //         if (event.type === 'message' && event.message.type === 'text') {
        //             const userText = event.message.text;

        //             return lineClient.replyMessage({
        //                 replyToken: event.replyToken,
        //                 messages: [
        //                     {
        //                         type: 'text',
        //                         text: `你說的是：${userText}`
        //                     }
        //                 ]
        //             })
        //         } else {
        //             // 明確 return null，避免 Promise.all 出現 undefined
        //             return Promise.resolve(null);
        //         }
        //     })
        // );

        res.status(200).json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook Error]', error);
        // 就算有錯也回傳 200，避免 LINE 認為你掛掉
        res.status(200).json({ status: 'error', message: error.message });
    }
});

export default router;