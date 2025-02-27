import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import multer from "multer";
import { Storage } from "@google-cloud/storage";
import FormData from "form-data";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Подключение Google Cloud Storage
const storage = new Storage({
    projectId: process.env.GOOGLE_PROJECT_ID,
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
});
const bucketName = "colibri-notifications";

// Настройка CORS
app.use(cors({
    origin: ["https://colibri.sale"],
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// 🔹 Подключаем API проверки пользователей
import checkCustomerRoutes from "./api/check-customer.js";
app.use("/api", checkCustomerRoutes);

app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});


let globalNotifications = []; // Храним все уведомления

// 🔹 Эндпоинт: Получение количества непрочитанных уведомлений
app.get("/api/notifications/unread", (req, res) => {
    const unreadCount = globalNotifications.filter(n => !n.read).length;
    res.json({ success: true, unread: unreadCount });
});

// 🔹 Эндпоинт: Пометить все уведомления как прочитанные
app.put("/api/notifications/read", (req, res) => {
    globalNotifications.forEach(n => n.read = true);
    res.json({ success: true, message: "Все уведомления прочитаны" });
});

// 🔹 Эндпоинт: Получение всех уведомлений
app.get("/api/notifications", (req, res) => {
    res.json({ success: true, notifications: globalNotifications });
});

// 🔹 Эндпоинт: Отправка уведомления
app.post("/api/notifications/send", upload.single("image"), async (req, res) => {
    try {
        const { title = "", message = "", link = "", userFilter } = req.body;
        const imageFile = req.file;
        let imageUrl = "";

        // Обработка изображения
        if (imageFile) {
            try {
                console.log("📸 Загружаем изображение в Google Cloud Storage...");
                const fileName = `${Date.now()}_${imageFile.originalname}`;
                const bucket = storage.bucket(bucketName);
                const file = bucket.file(fileName);

                // Запись файла в облако с правильными метаданными
                await new Promise((resolve, reject) => {
                    const stream = file.createWriteStream({
                        metadata: {
                            contentType: imageFile.mimetype,
                        },
                        resumable: false, // Важно: отключаем возобновляемую загрузку
                    });

                    stream.on("error", (err) => {
                        console.error("⚠️ Ошибка при загрузке в GCS:", err.message);
                        reject(err);
                    });

                    stream.on("finish", async () => {
                        try {
                            // Делаем файл публичным
                            await file.makePublic();
                            imageUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
                            console.log("✅ Файл загружен успешно:", imageUrl);
                            resolve();
                        } catch (err) {
                            console.error("⚠️ Ошибка при установке публичного доступа:", err.message);
                            reject(err);
                        }
                    });

                    stream.end(imageFile.buffer);
                });
            } catch (err) {
                console.error("⚠️ Ошибка загрузки изображения в GCS:", err.message);
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

        // Создаем новое уведомление
        const newNotification = { 
            id: Date.now(), 
            title, 
            message, 
            image: imageUrl, 
            link,  // Сохраняем ссылку
            timestamp: new Date().toISOString(),
            read: false
        };

        // Добавляем уведомление в массив
        globalNotifications.unshift(newNotification);

        res.json({ success: true, message: "Уведомление отправлено!" });
    } catch (error) {
        console.error("❌ Ошибка при отправке:", error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления" });
    }
});

// 🔹 API для удаления одного уведомления
app.delete("/api/notifications/:id", (req, res) => {
    const notificationId = parseInt(req.params.id);
    globalNotifications = globalNotifications.filter(n => n.id !== notificationId);
    res.json({ success: true, message: "Уведомление удалено!" });
});

// 🔹 API для удаления всех уведомлений
app.delete("/api/notifications/clear", (req, res) => {
    globalNotifications = [];
    res.json({ success: true, message: "Все уведомления удалены!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});

// 🔹 Функции для фильтрации пользователей
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

// 🔹 Эндпоинт для пометки уведомлений как прочитанных
app.post("/api/notifications/read", (req, res) => {
    globalNotifications.forEach(n => n.read = true);
    res.json({ success: true, message: "Все уведомления помечены как прочитанные" });
});
