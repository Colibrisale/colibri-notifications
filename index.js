import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import multer from "multer";
import FormData from "form-data"; // Добавляем поддержку FormData

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ["https://colibri.sale"],
    methods: "GET,POST",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});

let globalNotifications = []; // Глобальный список уведомлений

// 🔹 Эндпоинт: Отправка уведомления
app.post("/api/notifications/send", upload.single("image"), async (req, res) => {
    try {
        const { title = "", message = "", link = "", userFilter } = req.body;
        const imageFile = req.file;
        let imageUrl = "";

        if (imageFile) {
            try {
                console.log("📸 Загружаем изображение в Shopify...");
                const formData = new FormData();
                formData.append("file", imageFile.buffer, imageFile.originalname);

                console.log("📤 Отправляем в Shopify, вот что в formData:", formData);

                const imageResponse = await axios.post(
                    `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/files.json`,
                    formData,
                    {
                        headers: {
                            "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                            "Accept": "application/json", // Явно указываем ожидаемый ответ
                            ...formData.getHeaders(),
                        },
                    }
                );
                imageUrl = imageResponse.data.file.public_url;
                console.log("📸 Изображение загружено:", imageUrl);
            } catch (err) {
                console.error("⚠️ Ошибка загрузки изображения:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
            }
        }

        // Фильтруем пользователей по выбору в админке
        let recipients = [];
        if (userFilter === "all") {
            recipients = await getAllUsers();
        } else if (userFilter === "registered") {
            recipients = await getRegisteredUsers();
        } else if (userFilter === "guests") {
            recipients = await getGuestUsers();
        }

        console.log(`📩 Отправляем уведомление ${userFilter} пользователям. Всего: ${recipients.length}`);
        
        const newNotification = { title, message, image: imageUrl, link, timestamp: new Date().toISOString() };
        globalNotifications.unshift(newNotification);

        res.json({ success: true, message: "Уведомление отправлено!" });
    } catch (error) {
        console.error("❌ Ошибка при отправке:", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления" });
    }
});

// API для получения всех уведомлений
app.get("/api/notifications", (req, res) => {
    res.json({ success: true, notifications: globalNotifications });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

// Функции для фильтрации пользователей
async function getAllUsers() {
    const response = await axios.get(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-01/customers.json`, {
        headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN }
    });
    return response.data.customers.map(c => c.email);
}

async function getRegisteredUsers() {
    const users = await getAllUsers();
    return users.filter(user => user);
}

async function getGuestUsers() {
    const registered = await getRegisteredUsers();
    return ["guest1@example.com", "guest2@example.com"].filter(g => !registered.includes(g));
}
