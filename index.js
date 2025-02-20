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

// 🔹 Эндпоинт: Отправка уведомления в Shopify
app.post("/api/notifications/send", upload.single("image"), async (req, res) => {
    try {
        const { customerId, title = "", message = "", link = "" } = req.body;
        const imageFile = req.file;

        if (!customerId) {
            console.error("❌ Ошибка: customerId отсутствует в запросе!", req.body);
            return res.status(400).json({ success: false, error: "customerId обязателен!" });
        }

        console.log("✅ Получен запрос на отправку уведомления:", req.body);

        let imageUrl = "";
        if (imageFile) {
            try {
                console.log("📸 Загружаем изображение в Shopify...");
                const formData = new FormData();
                formData.append("file", imageFile.buffer, imageFile.originalname);

                const imageResponse = await axios.post(
                    `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/files.json`,
                    formData,
                    {
                        headers: {
                            "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                            ...formData.getHeaders(),
                        },
                    }
                );
                imageUrl = imageResponse.data.file.public_url;
                console.log("📸 Изображение загружено:", imageUrl);
            } catch (err) {
                console.error("⚠️ Ошибка загрузки изображения, продолжаем без него.", err.message);
            }
        }

        // 🔹 Получаем текущие уведомления из метафилдов
        let existingNotifications = [];
        try {
            const getResponse = await axios.get(
                `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/metafields.json`,
                {
                    headers: {
                        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                        "Accept": "application/json"
                    }
                }
            );

            if (getResponse.data.metafields) {
                const notifMetafield = getResponse.data.metafields.find(m => m.namespace === "notifications");
                if (notifMetafield) {
                    existingNotifications = JSON.parse(notifMetafield.value);
                }
            }
        } catch (err) {
            console.error("⚠️ Ошибка получения метафилдов, продолжаем без них.", err.message);
        }

        // 🆕 Добавляем новое уведомление
        const newNotification = { title, message, image: imageUrl, link, timestamp: new Date().toISOString() };
        existingNotifications.unshift(newNotification);

        // ✏️ Записываем обратно в Shopify
        try {
            await axios.put(
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
        } catch (err) {
            console.error("⚠️ Ошибка записи уведомления, но продолжаем.", err.message);
        }

        res.json({ success: true, message: "Уведомление отправлено в Shopify!" });
    } catch (error) {
        console.error("❌ Ошибка при отправке:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления в Shopify" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
