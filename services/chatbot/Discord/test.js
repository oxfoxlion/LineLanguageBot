import sendDiscordMessage, { client } from './discordBot.js'; // 引入 client
import { Events } from 'discord.js';

console.log('開始測試 Discord 機器人...');

// 監聽機器人「準備完成」的事件，確保連線後才發送
client.once(Events.ClientReady, async () => {
    console.log('測試腳本：偵測到機器人已就緒，開始發送訊息...');
    
    await sendDiscordMessage('這是一則來自測試腳本的訊息 🚀');

    // 測試完畢後，關閉程式，不然終端機會一直卡著
    console.log('測試完成，關閉程序。');
    process.exit(0);
});

// 這裡不需要再呼叫 login，因為 import discordBot.js 時該檔案已經執行了 login