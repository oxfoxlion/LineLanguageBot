import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatWithOpenAI(history) {
  const messages = [
    { role: "system", content: `你是友善、簡潔的助理，名字叫星星。用繁體中文回覆，每次不超過 500 字，內容要適合在 LINE 純文字閱讀：不要用 Markdown 樣式（不要 #、**、程式碼框、引用塊），純文字排版，段落間空一行 `},
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  const r = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages,
    temperature: 0.6,
  });
  return r.choices[0].message.content.trim();
}