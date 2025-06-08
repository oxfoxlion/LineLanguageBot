import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function askChatGPT(language, mode, userInput) {

    const promptMap = {
        en: 'You are a helpful English learning assistant. Please only respond in English.',
        ja: 'あなたは親切な日本語学習アシスタントです。返答はすべて日本語で行ってください。',
        fr: 'Tu es un assistant utile pour apprendre le français. Réponds uniquement en français.',
    };

     const systemPrompt = promptMap[language] || promptMap.en; // 預設英文

    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: systemPrompt  },
            { role: 'user', content: userInput },
        ]
    })

    return completion.choices[0].message.content;
}