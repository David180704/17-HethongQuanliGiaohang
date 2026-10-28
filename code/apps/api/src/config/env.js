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

  mongoUri: required("MONGO_URI", "mongodb://localhost:27017/edms?directConnection=true"),

  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  // Cache doc du lieu (xem infrastructure/cache/CacheService.js):
  //   CACHE_TTL_SECONDS: so giay giu du lieu trong cache (mac dinh 30, dat 0 = tat cache)
  //   CACHE_STORE: redis (mac dinh) | memory (khong can Redis, chi hop cho 1 tien trinh)
  cache: {
    store: process.env.CACHE_STORE === "memory" ? "memory" : "redis",
    ttlSeconds: process.env.CACHE_TTL_SECONDS ? Number(process.env.CACHE_TTL_SECONDS) : 30,
  },

  // Vite dev mac dinh 5173; them domain that vao .env (CORS_ORIGIN) khi deploy.
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:8081,http://localhost:8082").split(",").map((s) => s.trim()),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  },

  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.MAIL_FROM || "EDMS <no-reply@edms.vn>",
  },
};
