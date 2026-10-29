import { Router } from "express";
import { asyncHandler } from "../../core/response.js";
import { OrderController } from "./OrderController.js";

/**
 * @openapi
 * components:
 *   schemas:
 *     EstimateFeeInput:
 *       type: object
 *       required: [pickup, receiver, item]
 *       properties:
 *         pickup: { type: object, properties: { province: { type: string, example: "Hà Nội" }, district: { type: string, example: "Cầu Giấy" } } }
 *         receiver: { type: object, properties: { province: { type: string, example: "TP Hồ Chí Minh" }, district: { type: string, example: "Quận 1" } } }
 *         item:
 *           type: object
 *           properties:
 *             weightGram: { type: number, example: 1200 }
 *             length: { type: number, example: 30, description: cm }
 *             width: { type: number, example: 20, description: cm }
 *             height: { type: number, example: 10, description: cm }
 *             declaredValue: { type: number, example: 500000 }
 *         flags: { type: object, properties: { fragile: { type: boolean }, highValue: { type: boolean }, isVehicle: { type: boolean } } }
 *         serviceTypeId: { type: string, description: "Bo trong -> bao gia moi loai dich vu dang hoat dong" }
 * /orders/estimate-fee:
 *   post:
 *     tags: [Orders]
 *     summary: Uoc tinh phi van chuyen - CONG KHAI, khong can dang nhap (US-16)
 *     description: Tu xac dinh zone tu khu vuc phuc vu hai dau, khoi luong quy doi, bang gia dang hieu luc.
 *     requestBody:
 *       content: { application/json: { schema: { $ref: "#/components/schemas/EstimateFeeInput" } } }
 *     responses:
 *       200: { description: "zone, chargeableWeight va phi tung loai dich vu (base, weightSurcharge, serviceSurcharge, specialSurcharge, total)" }
 *       400: { description: Thieu dia chi hoac kich thuoc/khoi luong khong hop le }
 *       422: { description: OUT_OF_SERVICE_AREA (noi gui/nhan ngoai vung phuc vu) hoac PRICE_NOT_AVAILABLE }
 */

export function buildOrdersRouter({ pricingService }) {
  const controller = new OrderController({ pricingService });
  const router = Router();
  // Cong khai: khach vang lai uoc tinh phi truoc khi dang ky
  router.post("/estimate-fee", asyncHandler(controller.estimateFee));
  return router;
}
