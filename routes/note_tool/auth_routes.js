import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import { createUser, getUserByEmail, getFullUserById, updateTwoFactorSecret } from '../../services/note_tool/note_tool_user.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_COOKIE_NAME = 'note_tool_token';
const REFRESH_COOKIE_NAME = 'note_tool_refresh_token';
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
const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: COOKIE_SAMESITE,
  secure: COOKIE_SECURE,
};
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const ACCESS_COOKIE_MAX_AGE = 1000 * 60 * 15;
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const REFRESH_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

function issueAccessToken(userId) {
  return jwt.sign({ userId, type: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

function issueRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...BASE_COOKIE_OPTIONS,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, BASE_COOKIE_OPTIONS);
  res.clearCookie(REFRESH_COOKIE_NAME, BASE_COOKIE_OPTIONS);
}

// === 1. 註冊 ===
router.post('/register', async (req, res) => {
  try {
    const { id, email, displayName, password } = req.body;
    if (!id || !email || !password) return res.status(400).json({ message: '缺少必要欄位' });

    const newUser = await createUser({ id, email, displayName, password });
    res.status(201).json({ message: '註冊成功', user: newUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === 2. 登入 (第一階段) ===
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUserByEmail(email); //第一階段先取得使用者資料(包含密碼雜湊)

    if (!user) return res.status(401).json({ message: '帳號或密碼錯誤' });

    // 比對雜湊密碼
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: '帳號或密碼錯誤' });

    // 檢查是否啟用 2FA
    if (user.two_factor_enabled) {
      return res.json({ 
        message: '請輸入兩步驟驗證碼', 
        require2FA: true, 
        userId: user.id 
      });
    }

    // 未啟用 2FA，直接發放 JWT
    const accessToken = issueAccessToken(user.id);
    const refreshToken = issueRefreshToken(user.id);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ message: '登入成功', token: accessToken, userId: user.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === 3. 2FA 設定：生成 QR Code ===
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  const { userId } = req.user; // 從已驗證的 JWT 中取得 userId，更安全
  const user = await getFullUserById(userId);
  if(!user) return res.status(404).json({ message: '找不到使用者'});

  const secret = generateSecret();
  // 使用 email 作為標籤，讓使用者在驗證器 App 中更容易識別
  const otpauth = generateURI({
    secret,
    label: user.email,
    issuer: 'ShaoNoteTool',
  });

  try {
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    // 先將 secret 存入資料庫，但尚未啟用 enabled
    await updateTwoFactorSecret(userId, secret, false);
    res.json({ qrCodeUrl, secret, userId, otpauthUrl: otpauth }); // 仍回傳 secret 方便手動輸入
  } catch (err) {
    res.status(500).json({ message: '生成 QR Code 失敗' });
  }
});

// === 4. 2FA 驗證與啟用 / 登入確認 ===
router.post('/2fa/verify', async (req, res) => {
  const { userId, email, token } = req.body;
  
  try {
    let user;
    // 登入第二步驗證時，應優先使用 login 回傳的 userId
    if (userId) {
      user = await getFullUserById(userId);
    } else if (email) {
      // 保留彈性，但主要流程應使用 userId
      user = await getUserByEmail(email);
    }

    if (!user) {
      return res.status(404).json({ message: '找不到對應的使用者' });
    }

    if (!user.two_factor_secret) {
        return res.status(400).json({ message: '使用者尚未設定兩步驟驗證' });
    }
    
    const isValid = verify({ token, secret: user.two_factor_secret });

    if (!isValid) return res.status(401).json({ message: '驗證碼錯誤' });

    // 若是第一次設定，則正式啟用
    if (!user.two_factor_enabled) {
      await updateTwoFactorSecret(user.id, user.two_factor_secret, true);
    }

    // 驗證成功，核發正式 JWT
    const accessToken = issueAccessToken(user.id);
    const refreshToken = issueRefreshToken(user.id);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ message: '驗證成功', token: accessToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === 5. 刷新 Access Token ===
router.post('/refresh', (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
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
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    return res.status(401).json({ message: '缺少 refresh token，請重新登入' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (!decoded?.userId || decoded?.type !== 'refresh') {
      return res.status(401).json({ message: 'refresh token 無效，請重新登入' });
    }

    const accessToken = issueAccessToken(decoded.userId);
    const nextRefreshToken = issueRefreshToken(decoded.userId);
    setAuthCookies(res, accessToken, nextRefreshToken);
    return res.json({ token: accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'refresh token 無效或已過期，請重新登入' });
  }
});

// === 5. 登出 ===
router.post('/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ message: '已登出' });
});

export default router;
