import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";
import { errorHandler, ErrorCodes } from "./core/errors.js";
import { env } from "./config/env.js";
import { getContainer } from "./container.js";
import { buildAuthRouter } from "./modules/auth/auth.router.js";
import { buildUsersRouter } from "./modules/users/users.router.js";
import { buildRoutesRouter } from "./modules/routes/routes.router.js";
import { buildServiceAreasRouter } from "./modules/serviceAreas/serviceAreas.router.js";
import { buildServiceTypesRouter } from "./modules/serviceTypes/serviceTypes.router.js";
import { buildPriceTablesRouter } from "./modules/priceTables/priceTables.router.js";
import { buildPublicRouter } from "./modules/public/public.router.js";

// Ten may chu MongoDB de /health cho biet dang dung CSDL nao (local hay cloud Atlas)
function describeDatabase() {
  const { host, name, readyState } = mongoose.connection;
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return { state: states[readyState] || "unknown", host, name, cloud: /mongodb\.net$/i.test(host || "") };
}

export function createApp(container = getContainer()) {
  const app = express();
  // exposedHeaders: cho trinh duyet doc duoc X-Cache (HIT/MISS) tu JS
  app.use(cors({ origin: env.corsOrigins, credentials: true, exposedHeaders: ["X-Cache"] }));
  app.use(express.json());

  app.get("/health", (req, res) => {
    const data = { status: "ok", cacheTtlSeconds: container.cache.defaultTtlSeconds };
    // Khong lo dia chi CSDL ra ngoai khi chay that
    if (env.nodeEnv !== "production") data.database = describeDatabase();
    res.json({ success: true, data });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/auth", buildAuthRouter(container));
  app.use("/users", buildUsersRouter(container));
  app.use("/routes", buildRoutesRouter(container));
  app.use("/serviceAreas", buildServiceAreasRouter(container));
  app.use("/serviceTypes", buildServiceTypesRouter(container));
  app.use("/priceTables", buildPriceTablesRouter(container));
  app.use("/public", buildPublicRouter(container));

  app.use((req, res, next) => {
    next(ErrorCodes.NOT_FOUND("Không tìm thấy đường dẫn"));
  });

  app.use(errorHandler);

  return app;
}
