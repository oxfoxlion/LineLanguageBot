import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function askChatGPT(userInput) {


    const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content:"請以繁體中文對話"},
            { role: 'user', content: userInput },
        ]
    })

    return completion.choices[0].message.content;
}