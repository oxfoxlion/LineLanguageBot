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

cron.schedule("30 21 2 2,4,6,8,10,12 *", async () => {
  console.log("[CRON] 雙數月的 2 號 21:30 提醒拍電表");
  
  const prompt = "星星，今天是雙數月2號，請提醒大家拍電表。簡短一句話就可以了。";
  
  try {
    const result = await callGPT(prompt, { groupId: process.env.LINE_HOUSE_ID });
    if (result.ok) console.log("[CRON] ✅ callGPT 執行成功");
    else console.warn("[CRON] ⚠️ callGPT 執行失敗");
  } catch (err) {
    console.error("[CRON] ❌ 錯誤：", err);
  }
}, { timezone: "Asia/Taipei" });

cron.schedule("30 21 2 1,3,5,7,9,11 *", async () => {
  console.log("[CRON] 單數月的 2 號 21:30 提醒繳水費");
  
  const prompt = "星星，今天是單數月2號，請提醒大家繳水費。簡短一句話就可以了。";
  
  try {
    const result = await callGPT(prompt, { groupId: process.env.LINE_HOUSE_ID });
    if (result.ok) console.log("[CRON] ✅ callGPT 執行成功");
    else console.warn("[CRON] ⚠️ callGPT 執行失敗");
  } catch (err) {
    console.error("[CRON] ❌ 錯誤：", err);
  }
}, { timezone: "Asia/Taipei" });

cron.schedule("30 21 15 2,4,6,8,10,12 *", async () => {
  console.log("[CRON] 雙數月的 15 號 21:30 提醒繳電費");
  
  const prompt = "星星，今天是雙數月15號，請提醒大家繳電費。簡短一句話就可以了。";
  
  try {
    const result = await callGPT(prompt, { groupId: process.env.LINE_HOUSE_ID });
    if (result.ok) console.log("[CRON] ✅ callGPT 執行成功");
    else console.warn("[CRON] ⚠️ callGPT 執行失敗");
  } catch (err) {
    console.error("[CRON] ❌ 錯誤：", err);
  }
}, { timezone: "Asia/Taipei" });

cron.schedule("30 21 4 * *", async () => {
  console.log("[CRON] 每個月 4 號 21:30 米茶滴全能貓S");
  
  const prompt = "星星，今天是4號，請提醒米茶要滴全能貓S。簡短一句話就可以了。";
  
  try {
    const result = await callGPT(prompt, { groupId: process.env.LINE_CAT_ID });
    if (result.ok) console.log("[CRON] ✅ callGPT 執行成功");
    else console.warn("[CRON] ⚠️ callGPT 執行失敗");
  } catch (err) {
    console.error("[CRON] ❌ 錯誤：", err);
  }
}, { timezone: "Asia/Taipei" });