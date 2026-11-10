import { Router } from "express";
import { asyncHandler } from "../../core/response.js";
import { TrackingController } from "./TrackingController.js";

/**
 * @openapi
 * /tracking/{code}:
 *   get:
 *     tags: [Tracking]
 *     summary: Tra cuu hanh trinh don bang ma van don - CONG KHAI, khong can dang nhap (US-22)
 *     description: >
 *       Tra trang thai theo 4 nhom ma khach thay (de 14) - Chua nhan, Da nhan - Chua giao, Da nhan - Dang giao,
 *       Da giao - kem cac moc hanh trinh co nhan. Doc ban hanh trinh do hang doi su kien ghi (US-21), thieu thi
 *       dung lai tu don. Khong lo ten, dia chi; so dien thoai nguoi nhan che dang 09xx xxx 678.
 *       Gioi han 20 lan/phut cho moi IP (header X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After).
 *     parameters: [{ in: path, name: code, required: true, schema: { type: string, example: "EXP1000000001" } }]
 *     responses:
 *       200: { description: "trackingCode, status, statusLabel, group, groupLabel, serviceName, sender { name, ward }, receiver { phone, district, province }, events [{ at, status, label }]" }
 *       400: { description: Ma van don sai dinh dang (EXP + 10 chu so) }
 *       404: { description: Khong co don voi ma nay }
 *       429: { description: "TOO_MANY_REQUESTS - qua 20 lan/phut" }
 */
export function buildTrackingRouter({ journeyService, middleware }) {
  const controller = new TrackingController({ journeyService });
  const router = Router();
  // Gioi han dem CA luot sai ma (chong do ma van don)
  router.get("/:code", middleware.trackingRateLimit, asyncHandler(controller.get));
  return router;
}
