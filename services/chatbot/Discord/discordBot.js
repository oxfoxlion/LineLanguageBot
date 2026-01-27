// src/services/discord/discordBot.js
import { Client, GatewayIntentBits, Events } from 'discord.js'; // 1. 多引入 Events
import dotenv from 'dotenv';
import { chatWithOpenAI } from "../openai/openai_keep.js";
import { makeConvId, ensureConversation, insertUserMessage, insertAssistantMessage, getRecentMessages } from "../messages.js";

dotenv.config();

// 加上 export 讓外部也能存取 client 狀態
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// 解決 DeprecationWarning: 使用 Events.ClientReady 代替字串 'ready'
client.once(Events.ClientReady, (c) => {
    console.log(`Discord 機器人已上線：${c.user.tag}`);
});

client.login(DISCORD_TOKEN);

client.on(Events.MessageCreate, async (message) => {
    console.log(`--- [Discord 訊息接收] ---`);
    console.log(`頻道名稱: ${message.channel.name || '私訊'}`);
    console.log(`頻道 ID: ${message.channelId}`);
    console.log(`傳送者: ${message.author.tag} (${message.author.id})`);
    console.log(`--------------------------`);
    // 排除機器人自己的訊息
    if (message.author.bot) return;

    const convId = makeConvId(message, "discord");
    
    // 1. 儲存對話紀錄
    await ensureConversation(convId, "group"); // Discord 頻道可視為 group
    await insertUserMessage({
        convId,
        lineMessageId: message.id, // 借用此欄位存 Discord message id
        senderId: message.author.id,
        content: message.content
    });

    // 2. 如果需要讓機器人回覆 (例如提到機器人時)
    if (message.mentions.has(client.user)) {
        const history = await getRecentMessages(convId, 12);
        const reply = await chatWithOpenAI(history);
        
        await message.reply(reply);
        await insertAssistantMessage({ convId, content: reply });
    }
});

// 4. 定義發送訊息的函式
// export default 讓你引用時不需要加 {}
export default async function sendDiscordMessage(messageContent) {
    try {
        if (!client.isReady()) {
             // 這裡只顯示 Log，不 throw error，避免讓伺服器崩潰
            console.warn('機器人尚未就緒，稍後再試。');
            return;
        }
        
        const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
        if (channel) {
            await channel.send(messageContent);
            console.log('Discord 訊息發送成功！');
        } else {
            console.error('找不到頻道');
        }
    } catch (error) {
        console.error('發送錯誤:', error);
    }
}

