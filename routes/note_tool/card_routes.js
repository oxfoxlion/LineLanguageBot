import express from 'express';
import { randomBytes } from 'crypto';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import {
  createCard,
  createCardShareLink,
  deleteCard,
  getBoardsByCard,
  getCardById,
  getCardByIdAny,
  getCardsByUser,
  getCardShareLinkByToken,
  listCardShareLinks,
  revokeCardShareLink,
  updateCard,
} from '../../services/note_tool/note_tool_card.js';

const router = express.Router();

// GET /share/:token: 透過分享 token 取得卡片內容
router.get('/share/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || String(token).trim().length < 16) {
      return res.status(400).json({ message: 'token 格式錯誤' });
    }

    const shareLink = await getCardShareLinkByToken(String(token).trim());
    if (!shareLink) {
      return res.status(404).json({ message: '找不到分享連結' });
    }
    if (shareLink.revoked_at) {
      return res.status(410).json({ message: '此分享連結已失效' });
    }
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ message: '此分享連結已過期' });
    }

    const card = await getCardByIdAny(shareLink.card_id);
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    res.json({
      card,
      share: {
        permission: shareLink.permission,
        expires_at: shareLink.expires_at,
      },
    });
  } catch (err) {
    res.status(500).json({ message: '讀取分享卡片時發生錯誤', error: err.message });
  }
});

// 套用 JWT 驗證中間件到所有 /cards 的路由
router.use(authMiddleware);

// GET /: 取得登入使用者的所有卡片
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId; // 從 JWT 取得，安全
    const cards = await getCardsByUser(userId);
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: '讀取卡片時發生錯誤', error: err.message });
  }
});

// POST /: 為登入使用者建立新卡片
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, content } = req.body;
    if (!title) {
      return res.status(400).json({ message: '標題為必填欄位' });
    }
    const newCard = await createCard({ user_id: userId, title, content });
    res.status(201).json(newCard);
  } catch (err) {
    res.status(500).json({ message: '建立卡片時發生錯誤', error: err.message });
  }
});

// GET /:cardId/boards: 取得包含此卡片的白板
router.get('/:cardId/boards', async (req, res) => {
  try {
    const userId = req.user.userId;
    const cardIdNum = Number(req.params.cardId);

    if (!Number.isInteger(cardIdNum) || cardIdNum <= 0) {
      return res.status(400).json({ message: 'cardId 格式錯誤' });
    }

    const card = await getCardById({ id: cardIdNum, user_id: userId });
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    const boards = await getBoardsByCard({ card_id: cardIdNum, user_id: userId });
    res.json(boards);
  } catch (err) {
    res.status(500).json({ message: '讀取卡片白板列表時發生錯誤', error: err.message });
  }
});

// GET /:cardId/share-links: 取得卡片分享連結
router.get('/:cardId/share-links', async (req, res) => {
  try {
    const userId = req.user.userId;
    const cardIdNum = Number(req.params.cardId);

    if (!Number.isInteger(cardIdNum) || cardIdNum <= 0) {
      return res.status(400).json({ message: 'cardId 格式錯誤' });
    }

    const card = await getCardById({ id: cardIdNum, user_id: userId });
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    const links = await listCardShareLinks({ card_id: cardIdNum });
    res.json(links);
  } catch (err) {
    res.status(500).json({ message: '讀取分享連結時發生錯誤', error: err.message });
  }
});

// POST /:cardId/share-links: 建立卡片分享連結
router.post('/:cardId/share-links', async (req, res) => {
  try {
    const userId = req.user.userId;
    const cardIdNum = Number(req.params.cardId);
    const { permission, expires_in_days } = req.body || {};

    if (!Number.isInteger(cardIdNum) || cardIdNum <= 0) {
      return res.status(400).json({ message: 'cardId 格式錯誤' });
    }

    const card = await getCardById({ id: cardIdNum, user_id: userId });
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    const normalizedPermission = permission === 'edit' ? 'edit' : 'read';
    let expiresAt = null;
    if (expires_in_days !== undefined) {
      const days = Number(expires_in_days);
      if (!Number.isFinite(days) || days <= 0 || days > 3650) {
        return res.status(400).json({ message: 'expires_in_days 必須介於 1 到 3650 之間' });
      }
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    const token = randomBytes(24).toString('base64url');
    const link = await createCardShareLink({
      card_id: cardIdNum,
      token,
      permission: normalizedPermission,
      expires_at: expiresAt,
      created_by: userId,
    });

    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ message: '建立分享連結時發生錯誤', error: err.message });
  }
});

// DELETE /:cardId/share-links/:shareLinkId: 撤銷卡片分享連結
router.delete('/:cardId/share-links/:shareLinkId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const cardIdNum = Number(req.params.cardId);
    const shareLinkIdNum = Number(req.params.shareLinkId);

    if (!Number.isInteger(cardIdNum) || cardIdNum <= 0) {
      return res.status(400).json({ message: 'cardId 格式錯誤' });
    }
    if (!Number.isInteger(shareLinkIdNum) || shareLinkIdNum <= 0) {
      return res.status(400).json({ message: 'shareLinkId 格式錯誤' });
    }

    const card = await getCardById({ id: cardIdNum, user_id: userId });
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    const revoked = await revokeCardShareLink({ id: shareLinkIdNum, card_id: cardIdNum });
    if (!revoked) {
      return res.status(404).json({ message: '找不到可撤銷的分享連結' });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '撤銷分享連結時發生錯誤', error: err.message });
  }
});

// PUT /:cardId: 更新登入使用者的特定卡片
router.put('/:cardId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cardId } = req.params;
        const { title, content } = req.body;

        if(!title){
            return res.status(400).json({message: '標題為必填欄位'});
        }

        const updatedCard = await updateCard({ id: cardId, user_id: userId, title, content });

        if(!updatedCard){
            return res.status(404).json({message: '找不到卡片，或您沒有權限更新此卡片'});
        }
        res.json(updatedCard);

    } catch (err) {
        res.status(500).json({ message: '更新卡片時發生錯誤', error: err.message });
    }
});

// DELETE /:cardId: 刪除登入使用者的特定卡片
router.delete('/:cardId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cardId } = req.params;

        const result = await deleteCard({ id: cardId, user_id: userId });

        if(!result.success){
            return res.status(404).json({message: '找不到卡片，或您沒有權限刪除此卡片'});
        }
        res.status(204).send(); // 成功刪除，回傳 204 No Content

    } catch (err) {
        res.status(500).json({ message: '刪除卡片時發生錯誤', error: err.message });
    }
});


export default router;
