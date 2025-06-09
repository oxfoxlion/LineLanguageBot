import * as line from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();
console.log('[debug] LINE_CHANNEL_SECRET exists:', !!process.env.LINE_CHANNEL_SECRET);

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const lineMiddleware = line.middleware(config);
export {lineClient,lineMiddleware};