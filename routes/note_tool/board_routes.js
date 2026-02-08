import express from 'express';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import { createCard } from '../../services/note_tool/note_tool_card.js';
import {
  addCardToBoard,
  createBoard,
  deleteBoard,
  getBoardById,
  getBoardsByUser,
  getCardsByBoard,
  updateBoardCardPosition,
  updateBoard,
  removeCardFromBoard,
} from '../../services/note_tool/note_tool_board.js';

const router = express.Router();

router.use(authMiddleware);

// GET /: 取得登入使用者的白板列表
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const boards = await getBoardsByUser(userId);
    res.json(boards);
  } catch (err) {
    res.status(500).json({ message: '讀取白板時發生錯誤', error: err.message });
  }
});

// POST /: 建立白板
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: '白板名稱為必填欄位' });
    }
    const board = await createBoard({ user_id: userId, name });
    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: '建立白板時發生錯誤', error: err.message });
  }
});

// GET /:boardId: 取得白板與卡片
router.get('/:boardId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const board = await getBoardById({ id: boardId, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }
    const cards = await getCardsByBoard({ board_id: boardId, user_id: userId });
    res.json({ board, cards });
  } catch (err) {
    res.status(500).json({ message: '讀取白板內容時發生錯誤', error: err.message });
  }
});

// PUT /:boardId: 更新白板名稱
router.put('/:boardId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { name, tags } = req.body;

    if (!name) {
      return res.status(400).json({ message: '白板名稱為必填欄位' });
    }
    if (tags !== undefined && !Array.isArray(tags)) {
      return res.status(400).json({ message: 'tags 必須為陣列' });
    }

    const updated = await updateBoard({
      id: boardId,
      user_id: userId,
      name,
      tags: tags?.map((tag) => String(tag)),
    });
    if (!updated) {
      return res.status(404).json({ message: '找不到白板' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: '更新白板時發生錯誤', error: err.message });
  }
});

// DELETE /:boardId: 刪除白板
router.delete('/:boardId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;

    const deleted = await deleteBoard({ id: boardId, user_id: userId });
    if (!deleted) {
      return res.status(404).json({ message: '找不到白板' });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '刪除白板時發生錯誤', error: err.message });
  }
});

// POST /:boardId/cards: 在白板內新增卡片
router.post('/:boardId/cards', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ message: '標題為必填欄位' });
    }

    const board = await getBoardById({ id: boardId, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const card = await createCard({ user_id: userId, title, content });
    const boardCard = await addCardToBoard({ board_id: boardId, card_id: card.id });
    res.status(201).json({ card, boardCard });
  } catch (err) {
    res.status(500).json({ message: '白板新增卡片時發生錯誤', error: err.message });
  }
});

// POST /:boardId/cards/:cardId: 將既有卡片加入白板
router.post('/:boardId/cards/:cardId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId, cardId } = req.params;

    const board = await getBoardById({ id: boardId, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const result = await addCardToBoard({ board_id: Number(boardId), card_id: Number(cardId) });
    if (!result) {
      return res.status(404).json({ message: '找不到卡片或卡片已在白板中' });
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: '加入白板時發生錯誤', error: err.message });
  }
});

// PUT /:boardId/cards/:cardId: 更新卡片在白板的位置
router.put('/:boardId/cards/:cardId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId, cardId } = req.params;
    const { x_pos, y_pos, width, height } = req.body;

    if (
      (x_pos !== undefined && !Number.isFinite(Number(x_pos))) ||
      (y_pos !== undefined && !Number.isFinite(Number(y_pos))) ||
      (width !== undefined && !Number.isFinite(Number(width))) ||
      (height !== undefined && !Number.isFinite(Number(height)))
    ) {
      return res.status(400).json({ message: 'x_pos, y_pos, width, height 必須為數字' });
    }

    const board = await getBoardById({ id: boardId, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const updated = await updateBoardCardPosition({
      board_id: Number(boardId),
      card_id: Number(cardId),
      x_pos: x_pos === undefined ? null : Number(x_pos),
      y_pos: y_pos === undefined ? null : Number(y_pos),
      width: width === undefined ? null : Number(width),
      height: height === undefined ? null : Number(height),
    });

    if (!updated) {
      return res.status(404).json({ message: '找不到卡片位置資料' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: '更新卡片位置時發生錯誤', error: err.message });
  }
});

// DELETE /:boardId/cards/:cardId: 從白板移除卡片
router.delete('/:boardId/cards/:cardId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId, cardId } = req.params;

    const board = await getBoardById({ id: boardId, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const removed = await removeCardFromBoard({
      board_id: Number(boardId),
      card_id: Number(cardId),
    });

    if (!removed) {
      return res.status(404).json({ message: '找不到白板中的卡片' });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '移除卡片時發生錯誤', error: err.message });
  }
});

export default router;
