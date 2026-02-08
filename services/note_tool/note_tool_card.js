import {query} from '../db.js';

function extractMentionIds(content) {
    if (!content) return [];
    const regex = /@\\[\\[(\\d+)\\|[^\\]]+\\]\\]/g;
    const ids = new Set();
    let match;
    while ((match = regex.exec(content))) {
        ids.add(Number(match[1]));
    }
    return Array.from(ids);
}

async function upsertCardLinks({fromCardId, toCardIds}) {
    await query('DELETE FROM note_tool.card_links WHERE from_card_id = $1;', [fromCardId]);
    if (!toCardIds || toCardIds.length === 0) return;
    const values = [];
    const params = [];
    let idx = 1;
    toCardIds.forEach((toId) => {
        values.push(`($${idx++}, $${idx++})`);
        params.push(fromCardId, toId);
    });
    const sql = `
      INSERT INTO note_tool.card_links (from_card_id, to_card_id)
      VALUES ${values.join(', ')}
      ON CONFLICT DO NOTHING;
    `;
    await query(sql, params);
}

/**
 * 建立新卡片
 * @param {string} user_id -使用者 id
 * @param {string} title - 卡片標題
 * @param {string} content -卡片內文
 * @returns {Promise<Object|null>} 回傳建立成功的卡片物件，包含 id, user_id, title, content, created_at,update_at
 */

export async function createCard({user_id, title, content}){
    if (!user_id || !title) throw new Error('Missing required fields');
    
    const sql=`
    INSERT INTO note_tool.cards (user_id, title, content)
    VALUES ($1, $2, $3)
    RETURNING *;
    `;

    const {rows}= await query(sql,[user_id, title, content]);
    const card = rows[0];
    const ids = extractMentionIds(content);
    await query('BEGIN');
    try {
        await upsertCardLinks({fromCardId: card.id, toCardIds: ids});
        await query('COMMIT');
    } catch (err) {
        await query('ROLLBACK');
        throw err;
    }
    return card;
}

/**取得使用者的卡片清單 
 * @param {string} user_id 使用者 id
 * @returns {Promise<Array>} 回傳該使用者的卡片列表
*/
export async function getCardsByUser(user_id){
    const sql=`
    SELECT * FROM note_tool.cards
    WHERE user_id = $1
    ORDER BY updated_at DESC;
    `;

    const {rows} = await query(sql,[user_id]);
    return rows;
}

/**編輯卡片
 * @param {BigInt} id - 卡片id
 * @param {string} user_id - 擁有卡片的使用者id
 * @param {string} title -卡片 title
 * @param {string} content  -卡片 content
 * @returns {Promise<Object|null>} 回傳編輯後的卡片內容
 */
export async function updateCard({id, user_id, title, content}){
    if (!id || !user_id || !title) throw new Error('Missing required fields');

    const sql=`
    UPDATE note_tool.cards
    SET title = $3,
        content = $4,
        updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *;
    `;

    const {rows} = await query(sql,[id,user_id,title,content]);
    if (rows.length === 0) {
        // 表示找不到該 ID 的卡片可供更新
        return null; 
    }
    const updated = rows[0];
    const ids = extractMentionIds(content);
    await query('BEGIN');
    try {
        await upsertCardLinks({fromCardId: id, toCardIds: ids});
        await query('COMMIT');
    } catch (err) {
        await query('ROLLBACK');
        throw err;
    }
    return updated;
}

/**
 * 刪除卡片
 * @param {BigInt} id - 卡片id
 * @param {string} user_id -擁有卡片的使用者 id
 * @returns  {success: boolean, id?: string, message?: string} 是否刪除成功
 */

export async function deleteCard({id,user_id}){
    if(!id || !user_id) throw new Error('Missing id or user_id');
    
    const sql=`
    DELETE FROM note_tool.cards
    WHERE id = $1 AND user_id = $2
    RETURNING id;
    `

    try{

        const {rows} = await query(sql,[id ,user_id]);

        if (rows.length >0){
            console.log(`卡片：${id} 刪除成功`);
            return {success:true, id:rows[0].id};
        }else{
            return {success:false, message:'Card not found'};
        }
    }catch(err){
        console.error('刪除失敗',err.message);
        throw err;
    }
    
}
