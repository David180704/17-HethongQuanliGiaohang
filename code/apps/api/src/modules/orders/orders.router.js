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
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: "Danh sach don theo pham vi: khach - don cua minh; nhan vien hub - don cua hub va buu cuc truc thuoc; admin - tat ca"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string }, description: "Loc trang thai, vd CREATED (don cho xac nhan)" }
 *       - { in: query, name: search, schema: { type: string }, description: "Ma van don, ten / so dien thoai nguoi nhan" }
 *     responses:
 *       200: { description: "Danh sach don, meta { page, limit, total }" }
 *   post:
 *     tags: [Orders]
 *     summary: Khach tao don - ca noi gui va noi nhan phai thuoc vung phuc vu; ghi trong transaction (counter + orders + orderDrafts)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickupLocationId, receiver, item, serviceTypeId]
 *             properties:
 *               pickupLocationId: { type: string, description: "Dia diem lay hang cua chinh khach (US-15)" }
 *               receiver:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   phone: { type: string }
 *                   address: { type: string }
 *                   province: { type: string }
 *                   district: { type: string }
 *                   ward: { type: string }
 *               item:
 *                 type: object
 *                 properties:
 *                   name: { type: string }
 *                   weightGram: { type: number }
 *                   length: { type: number }
 *                   width: { type: number }
 *                   height: { type: number }
 *                   declaredValue: { type: number }
 *                   packingType: { type: string, enum: [BOX, BAG, PALLET, ENVELOPE, OTHER] }
 *               flags: { type: object, properties: { fragile: { type: boolean }, highValue: { type: boolean }, isVehicle: { type: boolean } } }
 *               serviceTypeId: { type: string }
 *               cod:
 *                 type: object
 *                 description: "Thu ho (US-19). Mac dinh khong thu ho, nguoi nhan tra phi"
 *                 properties:
 *                   enabled: { type: boolean }
 *                   amount: { type: number, description: "> 0 khi bat, toi da 20.000.000" }
 *                   feePayer: { type: string, enum: [SHOP_PREPAID, RECIPIENT_PAID, DEDUCT_FROM_COD] }
 *                   feePaymentMethod: { type: string, enum: [QR, CASH], description: "Bat buoc khi SHOP_PREPAID" }
 *               draftToken: { type: string, description: "Tao tu ban nhap -> xoa nhap trong cung transaction" }
 *     responses:
 *       201: { description: "Don CREATED, ma van don EXP + 10 chu so, phi tach tung khoan" }
 *       400: { description: Thieu / sai du lieu }
 *       404: { description: Dia diem lay hang khong phai cua khach }
 *       422: { description: "OUT_OF_SERVICE_AREA (noi gui / noi nhan ngoai vung phuc vu); COD_LESS_THAN_FEE (khau tru phi ma thu ho < phi)" }
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Chi tiet don trong pham vi cua nguoi xem (ngoai pham vi -> 404)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet don kem statusHistory }
 *       404: { description: Khong co hoac khong thuoc pham vi }
 * /orders/{id}/confirm:
 *   post:
 *     tags: [Orders]
 *     summary: Nhan vien hub xac nhan don CREATED -> CONFIRMED, khoa phi (bang gia doi ve sau khong lam doi phi)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: "Don CONFIRMED, fee.lockedAt" }
 *       404: { description: Don khong thuoc hub cua nhan vien }
 *       409: { description: Don khong con o trang thai CREATED }
 */

// Xem don: moi vai tro mot pham vi rieng (OrderService), co mot trong cac quyen la du
const READ_PERMISSIONS = ["order:read:own", "order:read:hub", "order:read:assigned"];

export function buildOrdersRouter({ pricingService, orderService, middleware }) {
  const controller = new OrderController({ pricingService, orderService });
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  // Cong khai: khach vang lai uoc tinh phi truoc khi dang ky
  router.post("/estimate-fee", asyncHandler(controller.estimateFee));

  router.use(requireAuth);
  router.get("/", requirePermission(READ_PERMISSIONS), asyncHandler(controller.list));
  router.post("/", requirePermission("order:create"), asyncHandler(controller.create));
  router.get("/:id", requirePermission(READ_PERMISSIONS), asyncHandler(controller.get));
  router.post("/:id/confirm", requirePermission("order:approve"), asyncHandler(controller.confirm));
  return router;
}
