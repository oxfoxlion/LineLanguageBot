// 套件
import express from 'express';
import dotenv from 'dotenv';
// 檔案
import webhookRouter from './routes/webhook.js';
// 載入環境變數
dotenv.config();
//express建立伺服器
const app = express();

//設定 webhook 路由
app.use('/webhook', webhookRouter);

//將json轉為javascript物件
app.use(express.json());
//啟動伺服器
const PORT = process.env.PORT || 3000; //取.env變數的PORT
app.listen(PORT,()=>{
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
})