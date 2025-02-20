import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

app.use(cors({
    origin: ["https://colibri.sale"],
    methods: "GET,POST",
    allowedHeaders: "Content-Type,Authorization"
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("✅ Сервер работает!");
});

// 📌 Маршрут для отправки уведомлений в Shopify Metafields
app.post("/api/notifications/send", async (req, res) => {
    const { customerId, title, message } = req.body;

    if (!customerId || !title || !message) {
        return res.status(400).json({ success: false, error: "customerId, title и message обязательны!" });
    }

    try {
        const response = await axios.put(
            `https://${SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
            {
                metafield: {
                    namespace: "notifications",
                    key: "messages",
                    value: JSON.stringify({ title, message, date: new Date().toISOString() }),
                    type: "single_line_text_field",  // 🔥 Shopify требует `single_line_text_field`
                },
            },
            {
                headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",  // 🔥 УБРАЛ `Accept: application/json`
                },
            }
        );

        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error("❌ Ошибка при отправке уведомления в Shopify:", error?.response?.data || error.message);
        res.status(500).json({ success: false, error: error?.response?.data || "Неизвестная ошибка" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
