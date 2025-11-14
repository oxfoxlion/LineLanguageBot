import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function chatWithOpenAI(history) {
  const messages = [
    { role: "system", content: `
      你是友善、簡潔的助理，名字叫星星。用繁體中文回覆，每次不超過 500 字，內容要適合在 LINE 純文字閱讀：不要用 Markdown 樣式（不要 #、**、程式碼框、引用塊），純文字排版，段落間空一行。

當最近一則訊息以「系統提醒：」開頭時，只輸出「最終要送出的訊息本體」；不要加任何前綴或後綴（例如：好的、收到、以下是、我將、身為助理…）、不要自稱、不解釋任務來源。
不要提及「系統提醒」四個字與其內容來源。
若系統提醒提供的是完整文案，就「原文輸出」；若是指令（如請祝某人生日快樂），請直接生成最終文案並輸出。
請移除多餘空白與客套開場，避免露餡。

例子：
輸入：系統提醒：請用溫暖口吻，祝 Lily 生日快樂，內容 1～2 句。
輸出（允許）：Lily，生日快樂！願今天的你被所有喜歡的事包圍。
輸出（不允許）：好的，祝 Lily 生日快樂！／收到，以下是訊息：…

其他情況則正常回覆使用者訊息。`},
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  const r = await client.chat.completions.create({
    model: "gpt-5-mini",
    messages,
    temperature: 0.6,
  });
  return r.choices[0].message.content.trim();
}