import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { getContainer } from "./container.js";

async function main() {
  await connectDB();
  const app = createApp();
  // Consumer hang doi su kien doi trang thai don (US-21) chay cung tien trinh API
  getContainer().startOrderEventWorker();
  app.listen(env.port, () => {
    console.log(`EDMS API dang chay tai http://localhost:${env.port}`);
    console.log(`Swagger UI: http://localhost:${env.port}/api-docs`);
  });
}

main().catch((err) => {
  console.error("Khong khoi dong duoc server:", err);
  process.exit(1);
});
