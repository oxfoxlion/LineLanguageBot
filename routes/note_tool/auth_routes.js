import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { createUser, getUserByEmail, updateTwoFactorSecret } from '../../services/note_tool/note_tool_user.js';

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
router.post('/2fa/setup', async (req, res) => {
  const { userId } = req.body; // 實務上應從已驗證的 JWT 中取得
  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(userId, 'ShaoNoteTool', secret);

  try {
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    // 先將 secret 存入資料庫，但尚未啟用 enabled
    await updateTwoFactorSecret(userId, secret, false);
    res.json({ qrCodeUrl, secret });
  } catch (err) {
    res.status(500).json({ message: '生成 QR Code 失敗' });
  }
});

// === 4. 2FA 驗證與啟用 / 登入確認 ===
router.post('/2fa/verify', async (req, res) => {
  const { userId, token } = req.body;
  
  try {
    const user = await getUserByEmail(req.body.email); // 或透過 userId 尋找
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