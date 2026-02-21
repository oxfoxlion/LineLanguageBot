import express from 'express';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
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
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';
const SHARE_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24;
const cookieSameSiteRaw = (
  process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')
).toLowerCase();
const COOKIE_SAMESITE = ['lax', 'strict', 'none'].includes(cookieSameSiteRaw) ? cookieSameSiteRaw : 'lax';
const cookieSecureRaw = process.env.COOKIE_SECURE;
const computedCookieSecure =
  cookieSecureRaw === 'true'
    ? true
    : cookieSecureRaw === 'false'
      ? false
      : COOKIE_SAMESITE === 'none' || process.env.NODE_ENV === 'production';
const COOKIE_SECURE = COOKIE_SAMESITE === 'none' ? true : computedCookieSecure;

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf('=');
        if (index === -1) return [pair, ''];
        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      })
  );
}

function shareAccessCookieName(token) {
  const safeToken = String(token).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `note_tool_share_card_${safeToken}`;
}

function issueShareAccessToken(token) {
  return jwt.sign({ type: 'share-card-access', token }, JWT_SECRET, { expiresIn: '1d' });
}

function hasShareAccess(req, token) {
  const cookies = parseCookies(req);
  const accessToken = cookies[shareAccessCookieName(token)];
  if (!accessToken) return false;
  try {
    const payload = jwt.verify(accessToken, JWT_SECRET);
    return payload?.type === 'share-card-access' && payload?.token === token;
  } catch {
    return false;
  }
}

function grantShareAccess(res, token) {
  const accessToken = issueShareAccessToken(token);
  res.cookie(shareAccessCookieName(token), accessToken, {
    httpOnly: true,
    sameSite: COOKIE_SAMESITE,
    secure: COOKIE_SECURE,
    maxAge: SHARE_COOKIE_MAX_AGE,
  });
}

function toCardDescriptionSnippet(content, fallbackTitle = 'Shared Card') {
  const raw = content || '';
  const stripped = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const source = stripped || fallbackTitle;
  return source.slice(0, 150);
}

async function validateShareLinkOrFail(res, token) {
  const shareLink = await getCardShareLinkByToken(String(token).trim());
  if (!shareLink) {
    res.status(404).json({ message: '找不到分享連結' });
    return null;
  }
  if (shareLink.revoked_at) {
    res.status(410).json({ message: '此分享連結已失效' });
    return null;
  }
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    res.status(410).json({ message: '此分享連結已過期' });
    return null;
  }
  return shareLink;
}

// GET /share/:token/meta: 分享頁 metadata
router.get('/share/:token/meta', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || String(token).trim().length < 16) {
      return res.status(400).json({ message: 'token 格式錯誤' });
    }

    const shareLink = await validateShareLinkOrFail(res, token);
    if (!shareLink) return;

    const isPasswordProtected = Boolean(shareLink.password_hash);
    if (isPasswordProtected) {
      return res.json({
        isPasswordProtected: true,
        title: 'Protected shared card',
        description: 'This shared card is protected by password.',
      });
    }

    const card = await getCardByIdAny(shareLink.card_id);
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    const title = card.title?.trim() || 'Shared Card';
    return res.json({
      isPasswordProtected: false,
      title,
      description: toCardDescriptionSnippet(card.content, title),
    });
  } catch (err) {
    return res.status(500).json({ message: '讀取分享卡片資訊時發生錯誤', error: err.message });
  }
});

// POST /share/:token/unlock: 密碼驗證
router.post('/share/:token/unlock', async (req, res) => {
  try {
    const { token } = req.params;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!token || String(token).trim().length < 16) {
      return res.status(400).json({ message: 'token 格式錯誤' });
    }
    if (!password.trim()) {
      return res.status(400).json({ message: '請輸入密碼' });
    }

    const shareLink = await validateShareLinkOrFail(res, token);
    if (!shareLink) return;

    if (!shareLink.password_hash) {
      return res.status(400).json({ message: '此分享連結未設定密碼' });
    }

    const matched = await bcrypt.compare(password, shareLink.password_hash);
    if (!matched) {
      return res.status(403).json({ message: '密碼錯誤' });
    }

    grantShareAccess(res, token);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: '分享密碼驗證失敗', error: err.message });
  }
});

// GET /share/:token: 透過分享 token 取得卡片內容
router.get('/share/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || String(token).trim().length < 16) {
      return res.status(400).json({ message: 'token 格式錯誤' });
    }

    const shareLink = await validateShareLinkOrFail(res, token);
    if (!shareLink) return;

    if (shareLink.password_hash && !hasShareAccess(req, token)) {
      return res.status(403).json({
        code: 'PASSWORD_REQUIRED',
        message: '此分享連結需要密碼',
      });
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
    const { permission, expires_in_days, password } = req.body || {};

    if (!Number.isInteger(cardIdNum) || cardIdNum <= 0) {
      return res.status(400).json({ message: 'cardId 格式錯誤' });
    }

    const card = await getCardById({ id: cardIdNum, user_id: userId });
    if (!card) {
      return res.status(404).json({ message: '找不到卡片' });
    }

    const normalizedPermission = permission === 'edit' ? 'edit' : 'read';
    let passwordHash = null;
    if (password !== undefined) {
      if (typeof password !== 'string') {
        return res.status(400).json({ message: 'password 必須為字串' });
      }
      const trimmed = password.trim();
      if (trimmed.length > 0) {
        if (trimmed.length < 6 || trimmed.length > 12) {
          return res.status(400).json({ message: 'password 長度需介於 6 到 12 字元' });
        }
        passwordHash = await bcrypt.hash(trimmed, 10);
      }
    }

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
      password_hash: passwordHash,
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
