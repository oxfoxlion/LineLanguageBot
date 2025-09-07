// 套件
import express from 'express';
import dotenv from 'dotenv';
// 檔案
import "./services/db.js";            // 初始化連線池
import "./scripts/init-db.js";        // 跑建表（僅首次會生效，很快）
import webhookRouter from './routes/webhook.js';
// 載入環境變數
dotenv.config();
//express建立伺服器
const app = express();

//設定 webhook 路由
app.use('/webhook', webhookRouter);

//將json轉為javascript物件
app.use(express.json());

app.get("/", (_,res)=>res.send("OK"));
app.listen(process.env.PORT || 3000, ()=>console.log("Server started"));

//啟動伺服器
const PORT = process.env.PORT || 3000; //取.env變數的PORT
app.listen(PORT,()=>{
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
})