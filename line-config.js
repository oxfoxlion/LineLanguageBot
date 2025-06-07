import { Client, middleware } from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();
console.log('[debug] LINE_CHANNEL_SECRET exists:', !!process.env.LINE_CHANNEL_SECRET);

const config = {
    channelAccessToken:process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret:process.env.LINE_CHANNEL_SECRET,
}

const lineClient = new Client(config);
const lineMiddleware = middleware(config);
export {lineClient,lineMiddleware};