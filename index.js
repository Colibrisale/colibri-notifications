app.post("/api/notifications/send", upload.single("image"), async (req, res) => {
    try {
        let { customerId, title, message, link } = req.body;
        const imageFile = req.file;

        if (!title || !message) {
            console.error("❌ Ошибка: заголовок и сообщение обязательны", req.body);
            return res.status(400).json({ success: false, error: "title и message обязательны!" });
        }

        console.log("✅ Получен запрос на отправку уведомления:", req.body);

        let imageUrl = "";
        if (imageFile) {
            console.log("📸 Загружаем изображение в Shopify...");
            const imageResponse = await axios.post(
                `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/files.json`,
                {
                    file: {
                        attachment: imageFile.buffer.toString("base64"),
                        filename: imageFile.originalname
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
            imageUrl = imageResponse.data.file.public_url;
            console.log("📸 Изображение загружено:", imageUrl);
        }

        // Если отправка идет всем пользователям
        if (customerId === "all") {
            console.log("🔍 Получаем список всех клиентов...");
            const customersResponse = await axios.get(
                `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/customers.json`,
                {
                    headers: {
                        "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
                        "Accept": "application/json"
                    }
                }
            );

            const customers = customersResponse.data.customers;
            console.log(`👥 Найдено ${customers.length} клиентов, отправляем уведомления...`);

            for (const customer of customers) {
                await sendNotificationToCustomer(customer.id, title, message, imageUrl, link);
            }

            return res.json({ success: true, message: `Уведомления отправлены ${customers.length} пользователям!` });
        }

        // Отправка уведомления конкретному пользователю
        await sendNotificationToCustomer(customerId, title, message, imageUrl, link);

        res.json({ success: true, message: "Уведомление отправлено!" });

    } catch (error) {
        console.error("❌ Ошибка при отправке:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: "Ошибка при отправке уведомления в Shopify" });
    }
});

// Функция отправки уведомления конкретному пользователю
async function sendNotificationToCustomer(customerId, title, message, imageUrl, link) {
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
        image: imageUrl,
        link,
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

    console.log(`📩 Уведомление отправлено пользователю ${customerId}:`, newNotification);
}
