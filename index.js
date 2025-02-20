import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: ["https://colibri.sale"],
    methods: "GET,POST",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});

// 🔹 Эндпоинт: Отправка уведомления в Shopify (ТЕГИ + МЕТАФИЛДЫ)
app.post("/api/notifications/send", async (req, res) => {
    try {
        const { customerId, title, message } = req.body;

        if (!customerId || !title || !message) {
            console.error("❌ Ошибка: не хватает параметров", req.body);
            return res.status(400).json({ success: false, error: "customerId, title и message обязательны!" });
        }

        console.log("✅ Получен запрос на отправку уведомления:", req.body);

        // 🏷️ Добавляем тег в Shopify
        const tagResponse = await axios.post(
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

        console.log("🏷️ Тег добавлен:", tagResponse.data);

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
            timestamp: new Date().toISOString()
        };
        existingNotifications.unshift(newNotification); // Добавляем в начало списка

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

        console.log("📩 Уведомление записано в Shopify:", newNotification);
        res.json({ success: true, message: "Уведомление отправлено в Shopify!" });

    } catch (error) {
        console.error("❌ Ошибка при отправке:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления в Shopify" });
    }
});

// 🔹 Эндпоинт: Получение уведомлений клиента
app.get("/api/notifications/get/:customerId", async (req, res) => {
    try {
        const { customerId } = req.params;

        const response = await axios.get(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Accept": "application/json"
                }
            }
        );

        let notifications = [];
        if (response.data.metafields) {
            const notifMetafield = response.data.metafields.find(m => m.namespace === "notifications");
            if (notifMetafield) {
                notifications = JSON.parse(notifMetafield.value);
            }
        }

        res.json({ success: true, notifications });

    } catch (error) {
        console.error("❌ Ошибка при получении уведомлений:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при получении уведомлений" });
    }
});

// 🔹 Эндпоинт: Очистка уведомлений после просмотра
app.post("/api/notifications/clear", async (req, res) => {
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

        console.log(`🗑️ Уведомления для клиента ${customerId} очищены`);
        res.json({ success: true, message: "Уведомления очищены" });

    } catch (error) {
        console.error("❌ Ошибка при очистке уведомлений:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при очистке уведомлений" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
