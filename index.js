import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ["https://colibri.sale"],
    methods: "GET,POST",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());

// Настройка загрузки файлов
const upload = multer({ storage: multer.memoryStorage() });

app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});

// 🔹 Эндпоинт: Загрузка изображений в Shopify
app.post("/api/upload-image", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "Файл не загружен" });
        }

        const response = await axios.post(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/files.json`,
            {
                file: {
                    attachment: req.file.buffer.toString("base64"),
                    filename: req.file.originalname
                }
            },
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        res.json({ success: true, imageUrl: response.data.file.public_url });
    } catch (error) {
        console.error("❌ Ошибка при загрузке изображения:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при загрузке изображения в Shopify" });
    }
});

// 🔹 Эндпоинт: Отправка уведомления в Shopify
app.post("/api/notifications/send", async (req, res) => {
    try {
        const { customerId, title, message, imageUrl } = req.body;

        if (!customerId || !title || !message) {
            return res.status(400).json({ success: false, error: "customerId, title и message обязательны!" });
        }

        console.log("✅ Получен запрос на отправку уведомления:", req.body);

        // 🏷️ Добавляем тег в Shopify
        await axios.put(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}.json`,
            { customer: { id: customerId, tags: title } },
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        // 🔹 Получаем текущие уведомления из метафилдов
        const getResponse = await axios.get(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Accept": "application/json"
                }
            }
        );

        let existingNotifications = [];
        if (getResponse.data.metafields) {
            const notifMetafield = getResponse.data.metafields.find(m => m.namespace === "notifications");
            if (notifMetafield) {
                existingNotifications = JSON.parse(notifMetafield.value);
            }
        }

        // 🆕 Добавляем новое уведомление
        const newNotification = {
            title,
            message,
            imageUrl,
            timestamp: new Date().toISOString()
        };
        existingNotifications.unshift(newNotification);

        // ✏️ Записываем обратно в Shopify
        await axios.post(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
                metafield: {
                    namespace: "notifications",
                    key: "messages",
                    value: JSON.stringify(existingNotifications),
                    type: "json_string"
                }
            },
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        res.json({ success: true, message: "Уведомление отправлено в Shopify!" });

    } catch (error) {
        console.error("❌ Ошибка при отправке уведомления:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления в Shopify" });
    }
});

// 🔹 Эндпоинт: Удаление всех уведомлений
app.post("/api/notifications/delete", async (req, res) => {
    try {
        const { customerId } = req.body;
        await axios.post(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
                metafield: {
                    namespace: "notifications",
                    key: "messages",
                    value: "[]", // Очищаем список
                    type: "json_string"
                }
            },
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        res.json({ success: true, message: "Все уведомления удалены" });
    } catch (error) {
        console.error("❌ Ошибка при удалении уведомлений:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при удалении уведомлений" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
