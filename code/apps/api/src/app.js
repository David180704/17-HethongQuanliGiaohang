import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";
import { errorHandler, ErrorCodes } from "./core/errors.js";
import { authRouter } from "./modules/auth/auth.router.js";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ success: true, data: { status: "ok" } }));

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/auth", authRouter);

  app.use((req, res, next) => {
    next(ErrorCodes.NOT_FOUND("Khong tim thay duong dan"));
  });

  app.use(errorHandler);

  return app;
}
