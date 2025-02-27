import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Загружаем переменные окружения

const app = express();
app.use(express.json());

// ❗ БЕРЁМ ДАННЫЕ ИЗ ОКРУЖЕНИЯ
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; 
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;

app.get("/api/check-customer", async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Missing email" });

    try {
        const response = await axios.get(`https://${SHOPIFY_STORE_URL}/admin/api/2023-10/customers.json?email=${encodeURIComponent(email)}`, {
            headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN }
        });

        const isRegistered = response.data.customers.length > 0;
        res.json({ registered: isRegistered });
    } catch (error) {
        console.error("Error fetching Shopify customer:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// 🔹 Добавляем экспорт
export default app;
