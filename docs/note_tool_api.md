# Note Tool API 指引

這份文件提供給前端開發者，用於串接 Note Tool 的所有後端 API。

**基礎路徑**: 所有的 API 路徑都基於一個基礎路徑，例如 `/api`。以下文件中的路徑將以 `/note_tool/...` 表示，前端需自行加上基礎路徑前綴 (e.g., `/api/note_tool/...`)。

**驗證**: 大部分需要保護的路由都需要在 HTTP Header 中提供 JWT。
- **Header**: `Authorization`
- **格式**: `Bearer <your_jwt_token>`

---

## 驗證 (Authentication)

基礎路徑: `/note_tool/auth`

### 1. 註冊新帳號

- **Endpoint**: `POST /note_tool/auth/register`
- **描述**: 建立一個新的使用者帳號。
- **Request Body**:
  ```json
  {
    "id": "user_line_id_123",
    "email": "user@example.com",
    "displayName": "Shao",
    "password": "your_strong_password"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "message": "註冊成功",
    "user": {
      "id": "user_line_id_123",
      "email": "user@example.com",
      "display_name": "Shao",
      "created_at": "2026-02-02T12:00:00.000Z"
    }
  }
  ```
- **Error Response (400)**:
  ```json
  {
    "message": "缺少必要欄位"
  }
  ```

### 2. 登入 (第一階段)

- **Endpoint**: `POST /note_tool/auth/login`
- **描述**: 使用 email 和密碼進行登入。
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "your_strong_password"
  }
  ```
- **Success Response (未啟用 2FA)**:
  ```json
  {
    "message": "登入成功",
    "token": "your_jwt_token"
  }
  ```
- **Success Response (已啟用 2FA)**:
  ```json
  {
    "message": "請輸入兩步驟驗證碼",
    "require2FA": true,
    "userId": "user_line_id_123"
  }
  ```
- **Error Response (401)**:
  ```json
  {
    "message": "帳號或密碼錯誤"
  }
  ```

### 3. 設定 2FA (取得 QR Code)

- **Endpoint**: `POST /note_tool/auth/2fa/setup`
- **描述**: 為已登入的使用者產生 2FA 設定用的 QR Code。**此 API 需要驗證。**
- **Header**: `Authorization: Bearer <your_jwt_token>`
- **Request Body**: (空)
- **Success Response (200)**:
  ```json
  {
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "secret": "JBSWY3DPEHPK3PXP" 
  }
  ```
  > **注意**: `secret` 供使用者無法掃描 QR Code 時手動輸入。

### 4. 驗證 2FA (啟用或登入)

- **Endpoint**: `POST /note_tool/auth/2fa/verify`
- **描述**: 用於兩種情境：1) 首次設定 2FA 時，用來驗證並啟用。 2) 已啟用 2FA 的使用者在登入第二階段時，用來驗證並取得最終 token。
- **Request Body**:
  ```json
  {
    "userId": "user_line_id_123",
    "token": "123456" 
  }
  ```
  > `token` 是從 Google Authenticator 等驗證 App 上取得的 6 位數驗證碼。
- **Success Response (200)**:
  ```json
  {
    "message": "驗證成功",
    "token": "your_final_jwt_token"
  }
  ```
- **Error Response (401)**:
  ```json
  {
    "message": "驗證碼錯誤"
  }
  ```

---

## 卡片 (Cards)

基礎路徑: `/note_tool/cards`
**注意**: 以下所有 API 都需要驗證。請在 Header 中提供 JWT。

### 1. 取得所有卡片

- **Endpoint**: `GET /note_tool/cards/`
- **Header**: `Authorization: Bearer <your_jwt_token>`
- **Success Response (200)**:
  ```json
  [
    {
      "id": "1",
      "user_id": "user_line_id_123",
      "title": "我的第一張卡片",
      "content": "這是卡片內容。",
      "created_at": "2026-02-02T12:00:00.000Z",
      "updated_at": "2026-02-02T12:00:00.000Z"
    }
  ]
  ```

### 2. 新增一張卡片

- **Endpoint**: `POST /note_tool/cards/`
- **Header**: `Authorization: Bearer <your_jwt_token>`
- **Request Body**:
  ```json
  {
    "title": "新卡片的標題",
    "content": "新卡片的內容。"
  }
  ```
- **Success Response (201)**:
  ```json
  {
    "id": "2",
    "user_id": "user_line_id_123",
    "title": "新卡片的標題",
    "content": "新卡片的內容。",
    "created_at": "2026-02-02T12:05:00.000Z",
    "updated_at": "2026-02-02T12:05:00.000Z"
  }
  ```

### 3. 更新一張卡片

- **Endpoint**: `PUT /note_tool/cards/:cardId`
- **Header**: `Authorization: Bearer <your_jwt_token>`
- **Request Body**:
  ```json
  {
    "title": "更新後的標題",
    "content": "更新後的內容。"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "id": "1",
    "user_id": "user_line_id_123",
    "title": "更新後的標題",
    "content": "更新後的內容。",
    "created_at": "2026-02-02T12:00:00.000Z",
    "updated_at": "2026-02-02T12:10:00.000Z"
  }
  ```
- **Error Response (404)**:
  ```json
  {
      "message": "找不到卡片，或您沒有權限更新此卡片"
  }
  ```

### 4. 刪除一張卡片

- **Endpoint**: `DELETE /note_tool/cards/:cardId`
- **Header**: `Authorization: Bearer <your_jwt_token>`
- **Success Response**: `204 No Content`
- **Error Response (404)**:
  ```json
  {
      "message": "找不到卡片，或您沒有權限刪除此卡片"
  }
  ```
