import express from 'express';

import { lineClient, lineMiddleware } from '../line-config.js';
import { askChatGPT } from '../services/openai.js';

const router = express.Router();

router.post('/', lineMiddleware, async (req, res) => {
  try {
    console.log('[Webhook Triggered]');
    console.log(JSON.stringify(req.body, null, 2));

    // 測試成功回應
    res.status(200).json({ status: 'received' });
  } catch (error) {
    console.error('[Webhook Error]', error);
    // 就算有錯也回傳 200，避免 LINE 認為你掛掉
    res.status(200).json({ status: 'error', message: error.message });
  }
});

export default router;