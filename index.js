import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ["https://colibri.sale"], // Разрешаем запросы с твоего домена
    methods: "GET,POST",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());

// Тестовый маршрут для проверки сервера
app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});

// 📌 Новый маршрут для отправки уведомлений
app.post("/api/notifications/send", (req, res) => {
    const { customerId, title, message } = req.body;

    if (!customerId || !title || !message) {
        return res.status(400).json({ success: false, error: "customerId, title и message обязательны!" });
    }

    // Здесь можно добавить логику работы с Shopify API
    console.log("Получен запрос на отправку уведомления:", req.body);

    res.json({ success: true, message: "Уведомление отправлено!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
