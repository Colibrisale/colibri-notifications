app.post("/api/notifications/send", async (req, res) => {
    try {
        const { customerId, title, message } = req.body;
        if (!customerId || !title || !message) {
            return res.status(400).json({ success: false, error: "customerId, title и message обязательны!" });
        }

        console.log("✅ Получен запрос на отправку уведомления:", req.body);

        // Отправляем данные в Shopify API
        const response = await axios.post(
            `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers/${customerId}/tags.json`,
            {
                tags: title
            },
            {
                headers: {
                    "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        );

        console.log("📩 Ответ от Shopify:", response.data);

        res.json({ success: true, message: "Уведомление отправлено в Shopify!" });

    } catch (error) {
        console.error("❌ Ошибка при отправке:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления в Shopify" });
    }
});
