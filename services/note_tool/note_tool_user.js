import { query } from "../db.js";
import bcrypt from "bcrypt";

/**
 * 建立新使用者 (註冊)
 * @param {object} user - 使用者資料
 * @param {string} user.id - 使用者唯一識別碼
 * @param {string} user.email - 電子郵件
 * @param {string} user.displayName - 顯示名稱
 * @param {string} user.password - 加密後的密碼
 * @returns {Promise<Object|null>} 回傳建立成功的使用者資料，包含 id, email, display_name, created_at
 * 
 */

export async function createUser({id,email,displayName,password}){

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const sql=`
    INSERT INTO note_tool.users (id,email,display_name,password_hash)
    VALUES ($1, $2 ,$3 ,$4)
    RETURNING id, email, display_name, created_at;
    `;

    const {rows}=await query(sql,[id,email,displayName,passwordHash]);
    return rows[0];
}

/**
 * 以 id 取得使用者資料
 * @param {string} id - 使用者 id 
 * @returns {Promise<Object|null>} 回傳使用者物件，若找不到則回傳 undefined/null
 */
export  async function getUserById(id) {
    const sql=`
    SELECT id, email, display_name, created_at
    FROM note_tool.users
    WHERE id = $1;
    `;

    const {rows} = await query(sql,[id]);
    return rows[0];
}

/**
 * 用於 2FA 驗證：透過 ID 取得包含密碼雜湊與 2FA 狀態的使用者資料
 */
export async function getFullUserById(id) {
    const sql = `
    SELECT id, email, display_name, password_hash, two_factor_enabled, two_factor_secret, settings
    FROM note_tool.users
    WHERE id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0];
}

/**
 * 用於登入驗證：取得包含密碼雜湊與 2FA 狀態的使用者資料
 */
export async function getUserByEmail(email) {
    const sql = `
    SELECT id, email, display_name, password_hash, two_factor_enabled, two_factor_secret, settings
    FROM note_tool.users
    WHERE email = $1;
    `;
    const { rows } = await query(sql, [email]);
    return rows[0];
}

/**
 * 更新使用者的 2FA 設定
 */
export async function updateTwoFactorSecret(id, secret, enabled = false) {
    const sql = `
    UPDATE note_tool.users
    SET two_factor_secret = $2,
        two_factor_enabled = $3
    WHERE id = $1
    RETURNING id, two_factor_enabled;
    `;
    const { rows } = await query(sql, [id, secret, enabled]);
    return rows[0];
}

/**
 * 取得使用者設定
 */
export async function getUserSettings(id) {
    const sql = `
    SELECT settings
    FROM note_tool.users
    WHERE id = $1;
    `;
    const { rows } = await query(sql, [id]);
    return rows[0]?.settings ?? null;
}

/**
 * 更新使用者設定 (partial merge)
 */
export async function updateUserSettings(id, settings) {
    const sql = `
    UPDATE note_tool.users
    SET settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb
    WHERE id = $1
    RETURNING settings;
    `;
    const { rows } = await query(sql, [id, JSON.stringify(settings)]);
    return rows[0]?.settings ?? null;
}
