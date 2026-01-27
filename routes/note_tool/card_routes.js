import express from 'express';
import { createCard, deleteCard, getCardsByUser, updateCard } from '../../services/note_tool/note_tool_card.js';

const router = express.Router();

// 取得使用者卡片

router.get('/',async (req,res)=>{
    try{
        const {user_id} = req.query;
        
    }
})