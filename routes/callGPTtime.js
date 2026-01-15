import cron from "node-cron";
import callGPT from "../tools/callGPT.js";

const timeZone = "Asia/Taipei";

/** -------- 防重複註冊機制 -------- */
const registeredJobs = new Set();
/**
 * 產生唯一鍵：同一個 (時間 + 群組 + log 描述) 視為同一任務
 */
function makeKey(schedule, groupId, logText) {
  return JSON.stringify({ s: schedule, g: groupId, l: logText });
}

/**
 * 通用排程註冊器
 * @param {string} schedule - cron 表達式，如 "30 06 20 12 *"
 * @param {string} logText  - console.log 顯示文字
 * @param {string} prompt   - 給 GPT 的訊息
 * @param {string} groupId  - 目標 LINE 群組 ID
 */
function registerCronJob(schedule, logText, prompt, groupId) {
  // 1) 先驗證 cron 字串
  if (!cron.validate(schedule)) {
    console.error(`[CRON] ❌ 無效的 cron 表達式：${schedule} (${logText})`);
    return;
  }

  // 2) 防重複註冊
  const key = makeKey(schedule, groupId, logText);
  if (registeredJobs.has(key)) {
    console.warn(`[CRON] ⚠️ 已略過重複任務：${logText} @ ${schedule}`);
    return;
  }
  registeredJobs.add(key);

  // 3) 註冊真正的任務
  cron.schedule(
    schedule,
    async () => {
      console.log(`[CRON] ${logText}`);
      try {
        const result = await callGPT(prompt, { groupId });
        if (result?.ok) console.log("[CRON] ✅ callGPT 執行成功");
        else console.warn("[CRON] ⚠️ callGPT 執行失敗");
      } catch (err) {
        console.error("[CRON] ❌ 錯誤：", err);
      }
    },
    { timezone: timeZone }
  );
}

/**
 * 判斷今天是否在指定的「月/日～月/日」之間（不含年份）
 *
 * @param {number} startMonth
 * @param {number} startDay
 * @param {number} endMonth
 * @param {number} endDay
 * @param {string} timeZone  // 你在 cron schedule 內用的時區
 * @returns {boolean}
 */
function isDateInRange(startMonth, startDay, endMonth, endDay, timeZone = "Asia/Taipei") {
  const now = new Date();
  const current = new Date(now.toLocaleString("en-US", { timeZone }));

  const year = current.getFullYear();
  const currentTime = current.getTime();

  const start = new Date(year, startMonth - 1, startDay).getTime();
  const end   = new Date(year, endMonth  - 1, endDay).getTime();

  return currentTime >= start && currentTime <= end;
}

function pad(num) {
  return num.toString().padStart(2, "0");
}

function registerRangeReminder({
  startMonth,
  startDay,
  endMonth,
  endDay,
  hour,
  minute,
  logText,
  prompt,
  groupId,
}) {
  // 1) 把時間轉成 cron 字串（每天固定時間）
  const schedule = `${pad(minute)} ${pad(hour)} * * *`;

  // 2) 先驗證 cron 字串
  if (!cron.validate(schedule)) {
    console.error(`[CRON] ❌ 無效的 cron 表達式：${schedule} (${logText})`);
    return;
  }

  // 3) 防重複註冊（沿用你原本的機制）
  const key = makeKey(schedule, groupId, logText + `_range_${startMonth}/${startDay}-${endMonth}/${endDay}`);
  if (registeredJobs.has(key)) {
    console.warn(`[CRON] ⚠️ 已略過重複區間任務：${logText} @ ${schedule}`);
    return;
  }
  registeredJobs.add(key);

  // 4) 註冊真正的 cron 任務
  cron.schedule(
    schedule,
    async () => {
      // ⛔ 不在指定區間就直接跳過
      if (!isDateInRange(startMonth, startDay, endMonth, endDay, timeZone)) {
        console.log(
          `[CRON] ⏭️ 非指定區間（${startMonth}/${startDay}~${endMonth}/${endDay}），略過：${logText}`
        );
        return;
      }

      console.log(`[CRON] ${logText}`);
      try {
        const result = await callGPT(prompt, { groupId });
        if (result?.ok) console.log("[CRON] ✅ callGPT 執行成功");
        else console.warn("[CRON] ⚠️ callGPT 執行失敗");
      } catch (err) {
        console.error("[CRON] ❌ 錯誤：", err);
      }
    },
    { timezone: timeZone }
  );
}


/** ===================== 任 務 註 冊 ===================== **/

/** 每日經文：每天 21:30 **/
// registerCronJob(
//   "30 21 * * *",
//   "每日 21:30 經文時間",
//   "現在是每日經文時間，請參考前一天的經文，按著聖經章節的順序，從下一個章節中挑選一句聖經經句(請以中文和合本譯文為主並請附上出處)，加上一小段引導，讓大家可以藉此思想。",
//   process.env.LINE_PRAY_ID
// );

registerCronJob(
  "30 21 * * *",
  "每日 21:30 經文時間",
  "現在是每日經文時間，請參考前一天的經文，按著聖經章節的順序，從下一個章節中挑選一句聖經經句(請以中文和合本譯文為主並請附上出處)，加上一小段引導，讓大家可以藉此思想。舉例：前一天是馬太福音1:2，今天就應該是馬太福音第2章中由你任選一節，後天是馬太福音第3章。",
  process.env.LINE_PRAY_TEAM_ID
);

/** 雙數月 2 號 21:30：提醒拍電表 **/
registerCronJob(
  "30 21 2 2,4,6,8,10,12 *",
  "雙數月的 2 號 21:30 提醒拍電表",
  "星星，今天是雙數月2號，請提醒大家拍電表。簡短一句話就可以了。",
  process.env.LINE_HOUSE_ID
);

/** 單數月 2 號 21:30：提醒繳水費 **/
registerCronJob(
  "30 21 2 1,3,5,7,9,11 *",
  "單數月的 2 號 21:30 提醒繳水費",
  "星星，今天是單數月2號，請提醒大家繳水費。簡短一句話就可以了。",
  process.env.LINE_HOUSE_ID
);

/** 雙數月 15 號 21:30：提醒繳電費 **/
registerCronJob(
  "30 21 15 2,4,6,8,10,12 *",
  "雙數月的 15 號 21:30 提醒繳電費",
  "星星，今天是雙數月15號，請提醒大家繳電費。簡短一句話就可以了。",
  process.env.LINE_HOUSE_ID
);

/** 每月 4 號 21:30：米茶滴全能貓S **/
registerCronJob(
  "30 21 4 * *",
  "每個月 4 號 21:30 米茶滴全能貓S",
  "星星，今天是4號，請提醒米茶要滴全能貓S。簡短一句話就可以了。",
  process.env.LINE_CAT_ID
);

/** 10/1 21:30：米茶打疫苗 **/
registerCronJob(
  "30 21 1 10 *",
  "每年10月1號 21:30 米茶打疫苗",
  "星星，今天是10月1號，請提醒米茶要打疫苗。簡短一句話就可以了。",
  process.env.LINE_CAT_ID
);

/** 2/1 21:30：米茶預約健檢 **/
registerCronJob(
  "30 21 1 2 *",
  "每年2月1號 21:30 米茶預約健康檢查",
  "星星，今天是2月1號，請提醒米茶要預約健康檢查。簡短一句話就可以了。",
  process.env.LINE_CAT_ID
);

/** ---- 家庭生日群（早上 6:30） ---- **/

/** 12/20 06:30：阿嬤生日 **/
registerCronJob(
  "30 06 20 12 *",
  "每年12月20號 6:30 阿嬤生日",
  "系統提醒：今天是12月20號，請告訴大家今天是李月英女士的生日!!!請用溫暖的語調祝福李月英女士生日快樂。",
  process.env.LINE_FAMILY_ID
);

/** 09/15 06:30：阿公生日 **/
registerCronJob(
  "30 06 15 09 *",
  "每年09月15號 6:30 阿公生日",
  "系統提醒：今天是09月15號，請告訴大家今天是黃德才先生的生日!!!請用溫暖的語調祝福黃德才先生生日快樂。",
  process.env.LINE_FAMILY_ID
);

/** 09/07 06:30：媽媽生日 **/
registerCronJob(
  "30 06 07 09 *",
  "每年09月07號 6:30 媽媽生日",
  "系統提醒：今天是09月07號，請告訴大家今天是黃綉婷小姐的生日!!!請用溫暖的語調祝福黃綉婷小姐生日快樂。",
  process.env.LINE_FAMILY_ID
);

/** 10/09 06:30：舅舅生日 **/
registerCronJob(
  "30 06 09 10 *",
  "每年10月09號 6:30 舅舅生日",
  "系統提醒：今天是10月09號，請告訴大家今天是黃泰源先生的生日!!!請用溫暖的語調祝福黃泰源先生生日快樂。",
  process.env.LINE_FAMILY_ID
);

/** 12/01 06:30：貴姨生日（之後你可改成其他人） **/
registerCronJob(
  "30 06 01 12 *",
  "每年12月01號 6:30 貴姨生日",
  "系統提醒：今天是12月01號，請告訴大家今天是黃貴蘭小姐的生日!!!並用溫暖的語調祝福黃貴蘭小姐生日快樂。",
  process.env.LINE_FAMILY_ID
);

/** 01/14 06:30：爸爸生日（你備註「還沒改」—先保持） **/
registerCronJob(
  "30 06 14 01 *",
  "每年01月14號 6:30 爸爸生日",
  "系統提醒：今天是1月14號，請告訴大家今天是潘文生先生的生日!!!並用溫暖的語調祝福潘文生先生生日快樂。",
  process.env.LINE_FAMILY_ID
);

/** 08/10 06:30：小臻生日 **/
registerCronJob(
  "30 06 10 08 *",
  "每年08月10號 6:30 小臻生日",
  "系統提醒：告訴大家今天是8月10號，請大家猜猜看今天是什麼日子呢",
  process.env.LINE_FAMILY_ID
);
// 冠縈
registerCronJob(
  "30 06 08 10 *",
  "每年10月08號 6:30 冠縈生日",
  "系統提醒：告訴大家今天是10月08號，請大家猜猜看今天是什麼日子呢",
  process.env.LINE_FAMILY_ID
);

registerCronJob(
  "30 06 25 06 *",
  "每年06月25號 6:30 之翎生日",
  "系統提醒：告訴大家今天是06月25號，請告訴大家今天是之翎寶寶的生日，請大家猜猜看這個寶寶幾個月大了呢？(之翎是2003年出生的，如果有人問你的話可以幫忙計算月份，但請先確認現在是西元幾年)",
  process.env.LINE_FAMILY_ID
);

registerCronJob(
  "30 06 16 09 *",
  "每年09月16號 6:30 伯硯生日",
  "系統提醒：告訴大家今天是09月16號，請告訴大家今天是伯硯寶寶的生日，請大家猜猜看這個寶寶幾個月大了呢？(伯硯是2002年出生的，如果有人問你的話可以幫忙計算月份，但請先確認現在是西元幾年)",
  process.env.LINE_FAMILY_ID
);

registerCronJob(
  "30 06 28 03 *",
  "每年03月28號 6:30 依汝生日",
  "系統提醒：告訴大家今天是03月28號，請告訴大家今天是依汝寶寶的生日，請大家猜猜看這個寶寶幾個月大了呢？(依汝是2004年出生的，如果有人問你的話可以幫忙計算月份，但請先確認現在是西元幾年)",
  process.env.LINE_FAMILY_ID
);
// 姨丈
registerCronJob(
  "30 06 18 05 *",
  "每年05月18號 6:30 姨丈生日",
  "系統提醒：告訴大家今天是5月18號，請告訴大家今天是簡維昌先生的生日!!!並用溫暖的語調祝福簡維昌先生生日快樂。",
  process.env.LINE_FAMILY_ID
);
// 綺綺
registerCronJob(
  "30 06 18 11 *",
  "每年11月18號 6:30 綺綺生日 阿嬤生日",
  "系統提醒：告訴大家今天是11月18號，今天是李月英女士的生日和綺綺的生日，請大家祝福他們生日快樂。",
  process.env.LINE_FAMILY_ID
);
// 舅媽
registerCronJob(
  "30 06 23 01 *",
  "每年01月23號 6:30 舅媽生日",
  "系統提醒：今天是1月23號，請告訴大家今天是黃馨慧小姐的生日!!!並用溫暖的語調祝福黃馨慧小姐生日快樂。",
  process.env.LINE_FAMILY_ID
);

// 邵臻和莉兒
// Lily
registerCronJob(
  "30 06 24 04 *",
  "每年04月24號 6:30 寶寶生日",
  "系統提醒：今天是04月24號，請告訴大家今天是莉兒寶寶的生日，並請大家猜猜看這個寶寶幾個月大了呢(如果有人問你答案，請先確認今年是西元幾年，莉兒是1999年生)",
  process.env.LINE_LILY_SHAO_ID
);
// 邵
registerCronJob(
  "30 06 10 08 *",
  "每年08月10號 6:30 邵寶寶生日",
  "系統提醒：今天是08月10號，請告訴大家今天是邵臻寶寶的生日，並請大家猜猜看這個寶寶幾個月大了呢(如果有人問你答案，請先確認今年是西元幾年，邵臻是1997年生)",
  process.env.LINE_LILY_SHAO_ID
);

// 提醒要聚餐唷
registerCronJob(
  "00 19 01 07 *",
  "每年07月01號 19:00 要訂父親節慶祝的時間喔",
  "系統提醒：請你提醒大家下個月是父親節，請大家要開始討論聚餐時間唷",
  process.env.LINE_FAMILY_ID
);

registerCronJob(
  "30 06 08 08 *",
  "每年08月08號 06:30 父親節",
  "系統提醒：今天是父親節，請你祝福黃德才先生、黃泰源先生、潘文生先生、簡維昌先生父親節快樂",
  process.env.LINE_FAMILY_ID
);

registerCronJob(
  "00 19 01 04 *",
  "4月01號 06:30 母親節提醒",
  "系統提醒：下個月是母親節，請提醒大家要記得討論聚餐時間唷。另外也請你用開玩笑的語氣註明一下雖然今天是4月1日但這個不是愚人節提醒。",
  process.env.LINE_FAMILY_ID
);

registerCronJob(
  "30 06 09 05 *",
  "5月09號 06:30 母親節",
  "系統提醒：今天是母親節，請祝福李月英女士、黃馨慧小姐、黃綉婷小姐、黃貴蘭小姐母親節快樂",
  process.env.LINE_FAMILY_ID
);

// 你可以選擇性 export 工具，讓其他檔案也能複用
export { registerCronJob };
export default null;