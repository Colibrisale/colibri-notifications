import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import notificationsHandler from "./api/notifications.js"; // Подключаем новый обработчик

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ["https://colibri.sale"], // Разрешаем запросы с твоего домена
    methods: "GET,POST",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());

// Главная страница проверки сервера
app.get("/", (req, res) => {
    res.send("Сервер работает!");
});

// Маршрут для отправки уведомлений в Shopify
app.use("/api/notifications", notificationsHandler);

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
