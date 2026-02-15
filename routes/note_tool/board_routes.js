import express from 'express';
import { randomBytes } from 'crypto';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import { createCard } from '../../services/note_tool/note_tool_card.js';
import {
  addCardToBoard,
  createBoardRegion,
  createBoardShareLink,
  createBoard,
  deleteBoard,
  deleteBoardRegion,
  getBoardByIdAny,
  getBoardShareLinkByToken,
  getBoardById,
  getBoardsByUser,
  getCardsByBoardId,
  getCardsByBoard,
  getRegionsByBoard,
  listBoardShareLinks,
  revokeBoardShareLink,
  updateBoardCardPosition,
  updateBoardRegion,
  updateBoard,
  removeCardFromBoard,
} from '../../services/note_tool/note_tool_board.js';

const router = express.Router();

// GET /share/:token: 透過分享 token 取得白板內容
router.get('/share/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || String(token).trim().length < 16) {
      return res.status(400).json({ message: 'token 格式錯誤' });
    }

    const shareLink = await getBoardShareLinkByToken(String(token).trim());
    if (!shareLink) {
      return res.status(404).json({ message: '找不到分享連結' });
    }
    if (shareLink.revoked_at) {
      return res.status(410).json({ message: '此分享連結已失效' });
    }
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ message: '此分享連結已過期' });
    }

    const board = await getBoardByIdAny(shareLink.board_id);
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const [cards, regions] = await Promise.all([
      getCardsByBoardId(shareLink.board_id),
      getRegionsByBoard({ board_id: shareLink.board_id }),
    ]);

    res.json({
      board,
      cards,
      regions,
      share: {
        permission: shareLink.permission,
        expires_at: shareLink.expires_at,
      },
    });
  } catch (err) {
    res.status(500).json({ message: '讀取分享白板時發生錯誤', error: err.message });
  }
});

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

// GET /:boardId/regions: 取得白板區域
router.get('/:boardId/regions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const boardIdNum = Number(boardId);

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const regions = await getRegionsByBoard({ board_id: boardIdNum });
    res.json(regions);
  } catch (err) {
    res.status(500).json({ message: '讀取白板區域時發生錯誤', error: err.message });
  }
});

// POST /:boardId/regions: 新增白板區域
router.post('/:boardId/regions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId } = req.params;
    const { name, x_pos, y_pos, width, height } = req.body;
    const boardIdNum = Number(boardId);

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: '區域名稱為必填欄位' });
    }

    const x = Number(x_pos);
    const y = Number(y_pos);
    const w = Number(width);
    const h = Number(height);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
      return res.status(400).json({ message: 'x_pos, y_pos, width, height 必須為數字' });
    }
    if (w <= 0 || h <= 0) {
      return res.status(400).json({ message: 'width, height 必須大於 0' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const region = await createBoardRegion({
      board_id: boardIdNum,
      name: String(name).trim(),
      x_pos: x,
      y_pos: y,
      width: w,
      height: h,
    });
    res.status(201).json(region);
  } catch (err) {
    res.status(500).json({ message: '新增白板區域時發生錯誤', error: err.message });
  }
});

// PUT /:boardId/regions/:regionId: 更新白板區域
router.put('/:boardId/regions/:regionId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId, regionId } = req.params;
    const { name, x_pos, y_pos, width, height } = req.body;
    const boardIdNum = Number(boardId);
    const regionIdNum = Number(regionId);

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }
    if (!Number.isInteger(regionIdNum) || regionIdNum <= 0) {
      return res.status(400).json({ message: 'regionId 格式錯誤' });
    }

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: '區域名稱不可為空白' });
    }
    if (
      (x_pos !== undefined && !Number.isFinite(Number(x_pos))) ||
      (y_pos !== undefined && !Number.isFinite(Number(y_pos))) ||
      (width !== undefined && !Number.isFinite(Number(width))) ||
      (height !== undefined && !Number.isFinite(Number(height)))
    ) {
      return res.status(400).json({ message: 'x_pos, y_pos, width, height 必須為數字' });
    }
    if ((width !== undefined && Number(width) <= 0) || (height !== undefined && Number(height) <= 0)) {
      return res.status(400).json({ message: 'width, height 必須大於 0' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const updated = await updateBoardRegion({
      board_id: boardIdNum,
      id: regionIdNum,
      name: name === undefined ? null : String(name).trim(),
      x_pos: x_pos === undefined ? null : Number(x_pos),
      y_pos: y_pos === undefined ? null : Number(y_pos),
      width: width === undefined ? null : Number(width),
      height: height === undefined ? null : Number(height),
    });

    if (!updated) {
      return res.status(404).json({ message: '找不到白板區域' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: '更新白板區域時發生錯誤', error: err.message });
  }
});

// DELETE /:boardId/regions/:regionId: 刪除白板區域
router.delete('/:boardId/regions/:regionId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { boardId, regionId } = req.params;
    const boardIdNum = Number(boardId);
    const regionIdNum = Number(regionId);

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }
    if (!Number.isInteger(regionIdNum) || regionIdNum <= 0) {
      return res.status(400).json({ message: 'regionId 格式錯誤' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const deleted = await deleteBoardRegion({
      board_id: boardIdNum,
      id: regionIdNum,
    });
    if (!deleted) {
      return res.status(404).json({ message: '找不到白板區域' });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '刪除白板區域時發生錯誤', error: err.message });
  }
});

// GET /:boardId/share-links: 取得白板分享連結
router.get('/:boardId/share-links', async (req, res) => {
  try {
    const userId = req.user.userId;
    const boardIdNum = Number(req.params.boardId);

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const links = await listBoardShareLinks({ board_id: boardIdNum });
    res.json(links);
  } catch (err) {
    res.status(500).json({ message: '讀取分享連結時發生錯誤', error: err.message });
  }
});

// POST /:boardId/share-links: 建立白板分享連結
router.post('/:boardId/share-links', async (req, res) => {
  try {
    const userId = req.user.userId;
    const boardIdNum = Number(req.params.boardId);
    const { permission, expires_in_days } = req.body || {};

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
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
    const link = await createBoardShareLink({
      board_id: boardIdNum,
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

// DELETE /:boardId/share-links/:shareLinkId: 撤銷白板分享連結
router.delete('/:boardId/share-links/:shareLinkId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const boardIdNum = Number(req.params.boardId);
    const shareLinkIdNum = Number(req.params.shareLinkId);

    if (!Number.isInteger(boardIdNum) || boardIdNum <= 0) {
      return res.status(400).json({ message: 'boardId 格式錯誤' });
    }
    if (!Number.isInteger(shareLinkIdNum) || shareLinkIdNum <= 0) {
      return res.status(400).json({ message: 'shareLinkId 格式錯誤' });
    }

    const board = await getBoardById({ id: boardIdNum, user_id: userId });
    if (!board) {
      return res.status(404).json({ message: '找不到白板' });
    }

    const revoked = await revokeBoardShareLink({ id: shareLinkIdNum, board_id: boardIdNum });
    if (!revoked) {
      return res.status(404).json({ message: '找不到可撤銷的分享連結' });
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: '撤銷分享連結時發生錯誤', error: err.message });
  }
});

export default router;
