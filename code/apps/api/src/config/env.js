import "dotenv/config";

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Thieu bien moi truong bat buoc: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  // 4044 thay vi 4000: tren may dev cong 4000 da bi container khac (litellm_proxy) chiem.
  port: Number(process.env.PORT || 4044),

  mongoUri: required("MONGO_URI", "mongodb://localhost:27018/edms?directConnection=true"),

  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  // Hang doi su kien doi trang thai don (US-21, BullMQ tren Redis): thu lai toi da ORDER_EVENTS_ATTEMPTS lan,
  // gian cach tang dan tu ORDER_EVENTS_BACKOFF_MS; het luot -> <ten>-dlq
  // Tra cuu cong khai bang ma van don (US-22): toi da TRACKING_RATE_LIMIT lan / phut cho moi IP
  trackingRateLimit: { limit: Number(process.env.TRACKING_RATE_LIMIT || 20), windowSeconds: 60 },

  orderEvents: {
    // Test (node --test dat NODE_TEST_CONTEXT) dung hang doi rieng: API dev dang chay cung Redis khong
    // tieu thu su kien cua don thu nghiem (vd tu phan cong US-25 giua chung mot test).
    queueName: process.env.ORDER_EVENTS_QUEUE || (process.env.NODE_TEST_CONTEXT ? "order-events-test" : "order-events"),
    attempts: Number(process.env.ORDER_EVENTS_ATTEMPTS || 5),
    backoffMs: Number(process.env.ORDER_EVENTS_BACKOFF_MS || 2000),
  },

  // Cache doc du lieu (xem infrastructure/cache/CacheService.js):
  //   CACHE_TTL_SECONDS: so giay giu du lieu trong cache (mac dinh 30, dat 0 = tat cache)
  //   CACHE_STORE: redis (mac dinh) | memory (khong can Redis, chi hop cho 1 tien trinh)
  cache: {
    store: process.env.CACHE_STORE === "memory" ? "memory" : "redis",
    ttlSeconds: process.env.CACHE_TTL_SECONDS ? Number(process.env.CACHE_TTL_SECONDS) : 30,
  },

  // Vite dev mac dinh 5173; them domain that vao .env (CORS_ORIGIN) khi deploy.
  // 8082: App Nhan vien ban web; 8083: App Khach hang mobile ban web (apps/customer-mobile)
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:8081,http://localhost:8082,http://localhost:8083").split(",").map((s) => s.trim()),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  // Dia chi cong khai cua API (Render: https://<ten>.onrender.com) - VNPay chuyen nguoi dung ve
  // <publicApiUrl>/payments/vnpay/return va goi IPN /payments/vnpay/ipn (IPN can dia chi cong khai)
  publicApiUrl: (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 4044}`).replace(/\/$/, ""),

  // Cong thanh toan VNPay (US-44). Chua co VNPAY_TMN_CODE / VNPAY_HASH_SECRET thi API bao chua cau hinh.
  // Tai khoan sandbox dang ky tai https://sandbox.vnpayment.vn/devreg/
  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE || null,
    hashSecret: process.env.VNPAY_HASH_SECRET || null,
    payUrl: process.env.VNPAY_PAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    expireMinutes: Number(process.env.VNPAY_EXPIRE_MINUTES || 15),
  },
  // Tai khoan cong ty nhan tien chuyen khoan luc giao (ma VietQR tu sinh, US-33). Chua dat: may dev dung tai khoan
  // DEMO so 0000000000 (khong ton tai, quet chi de xem thu); chay that (production) chua dat thi bao chua cau hinh.
  companyBank: {
    code: process.env.COMPANY_BANK_CODE || null,
    accountNo: process.env.COMPANY_BANK_ACCOUNT || null,
    accountName: process.env.COMPANY_BANK_NAME || null,
  },
  // Sau khi thanh toan, API chuyen nguoi dung ve returnTo cua app: web phai thuoc CORS_ORIGIN,
  // app di dong phai bat dau bang mot trong cac tien to nay (scheme cua app, Expo Go khi dev)
  mobileReturnPrefixes: (process.env.MOBILE_RETURN_PREFIXES || "edmskh://,edmsnv://,exp://,exps://").split(",").map((s) => s.trim()),

  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.MAIL_FROM || "EDMS <no-reply@edms.vn>",
  },
};
