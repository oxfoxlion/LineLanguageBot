import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();

router.post('/', lineMiddleware, async (req, res) => {
    try {
        const events = req.body.events;

        for (const event of events) {

            if (event.type === 'message' && event.message.type === 'text') {

                // 取得使用者ID =>叫名子用
                const source = event.source;
                const userId = source.userId;
                if (!userId) {
                    console.warn('⚠️ 無法取得 userId，來源可能是群組或未加好友');
                    continue; // 或 return
                }

                // 取得使用者訊息
                const userText = event.message.text;

                try{
                    const profile = await lineClient.getProfile(userId);
                    const name = profile.displayName || '朋友';

                    const gptReply = await askChatGPT(`我是${name},${userText}`);

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

                // ✅ 新增：處理 quick reply 的三種模式指令
                // if (['學習模式', '考題模式', '對話模式'].includes(userText)) {
                //     // 制訂一個promt函數
                //     let prompt;
                //     //依據userText傳入promt函數
                //     switch (userText) {
                //         case '學習模式':
                //             prompt = '請用英文寫一篇簡短的生活場景短文（80~100字），列出10個重要單字並提供解釋和一題填空題。';
                //             break;
                //         case '考題模式':
                //             prompt = '請模擬一題 TOEIC 閱讀測驗題目（含選項與解析），難度中等。';
                //             break;
                //         case '對話模式':
                //             prompt = '你是一位英文對話教練，請提出一個日常生活的英文問題，讓使用者回答。不要提供答案。';
                //             break;
                //     }
                //     //傳入GPT
                //     try {
                //         const gptReply = await askChatGPT(prompt);

                //         await lineClient.replyMessage({
                //             replyToken: event.replyToken,
                //             messages: [
                //                 {
                //                     type: 'text',
                //                     text: gptReply.slice(0, 1000) // LINE 限制 1000 字
                //                 }
                //             ]
                //         });
                //     } catch (err) {
                //         console.error('❌ GPT 回覆失敗', err);
                //     }

                //     continue; // 這次處理結束，不往下執行
                // }



                // try {
                //     // 取得使用者名稱
                //     const profile = await lineClient.getProfile(userId);
                //     const name = profile.displayName || '朋友';

                //     //回覆打招呼 + 選單
                //     await lineClient.replyMessage({
                //         replyToken: event.replyToken,
                //         messages: [
                //             {
                //                 type: "text",
                //                 text: `Hi ${name}！請選擇你今天想練習的模式～`,
                //                 quickReply: {
                //                     items: [
                //                         {
                //                             type: "action",
                //                             action: {
                //                                 type: "message",
                //                                 label: "🧠 學習模式",
                //                                 text: "學習模式"
                //                             }
                //                         },
                //                         {
                //                             type: "action",
                //                             action: {
                //                                 type: "message",
                //                                 label: "📝 考題模式",
                //                                 text: "考題模式"
                //                             }
                //                         },
                //                         {
                //                             type: "action",
                //                             action: {
                //                                 type: "message",
                //                                 label: "💬 對話模式",
                //                                 text: "對話模式"
                //                             }
                //                         }
                //                     ]
                //                 }
                //             }
                //         ]
                //     });

                // } catch (error) {
                //     console.error("抓不到使用者名稱", error)
                // }

            }
        

        // 最一開始的鸚鵡測試
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