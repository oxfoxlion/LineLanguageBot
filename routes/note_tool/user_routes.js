import express from 'express';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import { getUserSettings, updateUserSettings } from '../../services/note_tool/note_tool_user.js';

const router = express.Router();

const DEFAULT_SETTINGS = {
  cardOpenMode: 'modal',
  cardPreviewLength: 120,
  theme: 'light',
};

router.use(authMiddleware);

// GET /settings: 取得使用者設定
router.get('/settings', async (req, res) => {
  try {
    const userId = req.user.userId;
    const stored = await getUserSettings(userId);
    res.json({ ...DEFAULT_SETTINGS, ...(stored || {}) });
  } catch (err) {
    res.status(500).json({ message: '讀取使用者設定時發生錯誤', error: err.message });
  }
});

// PUT /settings: 更新使用者設定 (partial)
router.put('/settings', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { cardOpenMode, cardPreviewLength, theme } = req.body || {};

    const nextSettings = {};
    if (cardOpenMode !== undefined) {
      if (!['modal', 'sidepanel'].includes(cardOpenMode)) {
        return res.status(400).json({ message: 'cardOpenMode 必須為 modal 或 sidepanel' });
      }
      nextSettings.cardOpenMode = cardOpenMode;
    }
    if (cardPreviewLength !== undefined) {
      const parsed = Number(cardPreviewLength);
      if (!Number.isFinite(parsed) || parsed < 40 || parsed > 500) {
        return res.status(400).json({ message: 'cardPreviewLength 必須為 40~500 的數字' });
      }
      nextSettings.cardPreviewLength = parsed;
    }
    if (theme !== undefined) {
      if (theme !== 'light') {
        return res.status(400).json({ message: 'theme 目前僅支援 light' });
      }
      nextSettings.theme = 'light';
    }

    if (Object.keys(nextSettings).length === 0) {
      return res.status(400).json({ message: '沒有可更新的設定' });
    }

    const updated = await updateUserSettings(userId, nextSettings);
    res.json({ ...DEFAULT_SETTINGS, ...(updated || {}) });
  } catch (err) {
    res.status(500).json({ message: '更新使用者設定時發生錯誤', error: err.message });
  }
});

export default router;
