import { query } from "../db.js";

/**
 * 建立新使用者 (註冊)
 * @param {object} user - 使用者資料
 * @param {string} user.id - 使用者唯一識別碼
 * @param {string} user.email - 電子郵件
 * @param {string} user.displayName - 顯示名稱
 * @param {string} user.passwordHash - 加密後的密碼
 * @returns {Promise<Object|null>} 回傳建立成功的使用者資料，包含 id, email, display_name, created_at
 * 
 */

export async function createUser({id,email,displayName,passwordHash}){
    const sql=`
    INSERT INTO note_tool.users (id,email,display_name,password_hash)
    VALUES ($1, $2 ,$3 ,$4)
    RETURNING id, email, display_name, created_at;
    `;

    const {rows}=await query(sql,[id,email,displayName,passwordHash]);
    return rows[0];
}

/**
 * 取得使用者資料
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