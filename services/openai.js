import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function askChatGPT(userText) {
    const userContent = String(userText ?? '');

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: "你是我們的AI小助手，請回答使用者提出的相關問題，回覆請限制於500字以內" },
            { role: 'user', content: userContent }
        ]
    })

    return completion.choices[0].message.content ?? '';
}