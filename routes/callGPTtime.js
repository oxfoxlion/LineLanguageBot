import cron from "node-cron";
import callGPT from "../tools/callGPT.js"; 

// 台灣時區為 UTC+8
const timeZone = "Asia/Taipei";

// 每天晚上 9:30 執行
cron.schedule("30 21 * * *", async () => {
  console.log("[CRON] 每晚 9:30 執行 callGPT()");

  // 這裡放你要給 GPT 的 prompt
  const prompt = "請告訴大家現在是每日經文時間，並提供一句聖經經句(請附出處)，加上一小段引導，讓大家可以藉此思想";

  try {
    const result = await callGPT(prompt,{groupId:process.env.LINE_PRAY_ID});
    if (result.ok) {
      console.log("[CRON] ✅ callGPT 執行成功");
    } else {
      console.warn("[CRON] ⚠️ callGPT 執行失敗");
    }
  } catch (err) {
    console.error("[CRON] ❌ 錯誤：", err);
  }
}, { timezone: timeZone });
