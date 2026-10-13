/** Централизованный доступ к переменным окружения. Секреты читаются только на сервере. */
export const env = {
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  isProd: process.env.NODE_ENV === "production",
  sessionSecret: process.env.SESSION_SECRET || "",
  onecToken: process.env.ONEC_API_TOKEN || "",
  onecHmacSecret: process.env.ONEC_HMAC_SECRET || "",
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
    from: process.env.SMTP_FROM || "M-TREND <no-reply@mtrend.kz>",
    secure: process.env.SMTP_SECURE === "true",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },
  whatsappCloud: {
    token: process.env.WHATSAPP_CLOUD_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    templateNewOrder: process.env.WHATSAPP_TEMPLATE_NEW_ORDER || "",
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || "local") as "local" | "s3",
    localDir: process.env.UPLOAD_DIR || "./storage/uploads",
    s3Endpoint: process.env.S3_ENDPOINT || "",
    s3Region: process.env.S3_REGION || "us-east-1",
    s3Bucket: process.env.S3_BUCKET || "",
    s3AccessKey: process.env.S3_ACCESS_KEY_ID || "",
    s3SecretKey: process.env.S3_SECRET_ACCESS_KEY || "",
    s3PublicUrl: (process.env.S3_PUBLIC_URL || "").replace(/\/$/, ""),
  },
  kaspi: {
    merchantId: process.env.KASPI_MERCHANT_ID || "",
    apiKey: process.env.KASPI_API_KEY || "",
  },
};
