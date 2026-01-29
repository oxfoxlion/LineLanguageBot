import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_fallback_secret';

/**
 * JWT 驗證中間件
 */
export const authMiddleware = (req, res, next) => {
  // 1. 從 Header 取得 Token (格式通常為 Authorization: Bearer <token>)
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供驗證憑證，請先登入' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 2. 驗證 Token 是否有效
    const decoded = jwt.verify(token, JWT_SECRET);

    // 3. 將解析出來的內容 (例如 userId) 塞入 req 物件中
    // 這樣後續的 router 就能透過 req.user.userId 拿到目前登入者的 ID
    req.user = decoded;

    // 4. 通過檢查，繼續執行下一個 function
    next();
  } catch (err) {
    console.error('[Auth Middleware] Token 驗證失敗:', err.message);
    return res.status(401).json({ message: '憑證無效或已過期，請重新登入' });
  }
};