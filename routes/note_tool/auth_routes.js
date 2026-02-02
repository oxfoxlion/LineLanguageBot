import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { authMiddleware } from '../../middlewares/note_tool/auth.js';
import { createUser, getUserByEmail, getFullUserById, updateTwoFactorSecret } from '../../services/note_tool/note_tool_user.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

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
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: '登入成功', token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// === 3. 2FA 設定：生成 QR Code ===
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  const { userId } = req.user; // 從已驗證的 JWT 中取得 userId，更安全
  const user = await getFullUserById(userId);
  if(!user) return res.status(404).json({ message: '找不到使用者'});

  const secret = authenticator.generateSecret();
  // 使用 email 作為標籤，讓使用者在驗證器 App 中更容易識別
  const otpauth = authenticator.keyuri(user.email, 'ShaoNoteTool', secret);

  try {
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    // 先將 secret 存入資料庫，但尚未啟用 enabled
    await updateTwoFactorSecret(userId, secret, false);
    res.json({ qrCodeUrl, secret }); // 仍回傳 secret 方便手動輸入
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
    
    const isValid = authenticator.verify({ token, secret: user.two_factor_secret });

    if (!isValid) return res.status(401).json({ message: '驗證碼錯誤' });

    // 若是第一次設定，則正式啟用
    if (!user.two_factor_enabled) {
      await updateTwoFactorSecret(user.id, user.two_factor_secret, true);
    }

    // 驗證成功，核發正式 JWT
    const jwtToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: '驗證成功', token: jwtToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;