import express from 'express';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import { createCard, deleteCard, getCardsByUser, updateCard } from '../../services/note_tool/note_tool_card.js';

const router = express.Router();

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