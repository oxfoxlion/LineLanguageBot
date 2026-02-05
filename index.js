// 套件
import express from 'express';
import dotenv from 'dotenv';
// 載入環境變數
dotenv.config();

// 檔案
import "./services/db.js";            // 初始化連線池
import webhookRouter from './routes/webhook.js';
import './routes/callGPTtime.js';
import noteToolAuthRouter from './routes/note_tool/auth_routes.js';
import noteToolCardRouter from './routes/note_tool/card_routes.js';
import "./services/chatbot/Discord/discordBot.js"

//express建立伺服器
const app = express();

//將json轉為javascript物件
app.use(express.json());

//設定 webhook 路由
app.use('/webhook', webhookRouter);
app.use('/note_tool/auth', noteToolAuthRouter);
app.use('/note_tool/card', noteToolCardRouter);

app.get("/", (_,res)=>res.send("OK"));

//啟動伺服器
const PORT = process.env.PORT || 3000; //取.env變數的PORT
app.listen(PORT,()=>{
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
})