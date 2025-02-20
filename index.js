const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

// Shopify API данные
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Проверка, заданы ли переменные окружения
if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
    console.error("❌ Ошибка: Переменные окружения SHOPIFY_STORE_URL и SHOPIFY_ACCESS_TOKEN не заданы!");
    process.exit(1);
}

// Эндпоинт для отправки уведомлений
app.post("/send-notification", async (req, res) => {
    const { customerId, title, message } = req.body;

    if (!customerId || !title || !message) {
        return res.status(400).json({ success: false, error: "Необходимо передать customerId, title и message" });
    }

    // Логируем перед отправкой
    console.log("📨 Отправка запроса в Shopify...");
    console.log("➡ URL:", `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`);
    console.log("➡ Headers:", {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
        "Accept": "application/json",
    });
    console.log("➡ Body:", {
        metafield: {
            namespace: "notifications",
            key: "messages",
            value: JSON.stringify({ title, message, date: new Date().toISOString() }),
            type: "json_string", // Shopify требует json_string
        },
    });

    try {
        const response = await axios.put(
            `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
                metafield: {
                    namespace: "notifications",
                    key: "messages",
                    value: JSON.stringify({ title, message, date: new Date().toISOString() }),
                    type: "json_string", // Исправлено
                },
            },
            {
                headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            }
        );

        console.log("✅ Уведомление успешно отправлено!", response.data);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("❌ Ошибка при отправке уведомления:", error?.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error?.response?.data || "Неизвестная ошибка"
        });
    }
});

// Тестовый эндпоинт
app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
