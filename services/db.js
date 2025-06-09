import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);
// 存入message
export async function saveMessage(userId, role, content) {
    try {
        const { error } = await supabase
            .from('messages')
            .insert([{ user_id: userId, role, content }]);

        if (error) {
            console.error('❌ saveMessage 錯誤', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ saveMessage 例外錯誤', error);
        return false;
    }
}
//取得message訊息
export async function getRecentMessages(userId, limit = 10) {
    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) {
        console.error('❌ 讀取訊息錯誤', error);
        return [];
    }

    return data;
}