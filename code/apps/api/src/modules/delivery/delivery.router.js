import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";
import { DELIVERY_FAIL_LABELS } from "./deliveryPolicy.js";

/**
 * @openapi
 * /deliveries/mine:
 *   get:
 *     tags: [Deliveries]
 *     summary: "Don can giao / can hoan cua nguoi giao hang trong ca hien tai (US-31): nguoi nhan, dia chi, so tien phai thu, so lan giao"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: shiftId, schema: { type: string }, description: "ma ca, hoac all = ca ngay" }]
 *     responses:
 *       200: { description: "{ shifts, currentShiftId, counts: { toDeliver, toReturn, done, failed, toCollect }, orders: [{ type, trackingCode, to, collect, attempts, express }] }" }
 *       403: { description: Khong phai nguoi giao hang }
 * /deliveries/fail-reasons:
 *   get:
 *     tags: [Deliveries]
 *     summary: "Nguyen nhan giao khong thanh cong (US-32, PB#40)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "[{ value, label }]" }
 * /deliveries/policy:
 *   get:
 *     tags: [Deliveries]
 *     summary: "Chinh sach giao lai (US-36): so lan giao toi da truoc khi hoan hang (mac dinh 3)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ maxDeliveryAttempts }" }
 *   put:
 *     tags: [Deliveries]
 *     summary: "Quan tri vien doi so lan giao toi da (1-10)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, properties: { maxDeliveryAttempts: { type: integer, example: 3 } } } } }
 *     responses:
 *       200: { description: "{ maxDeliveryAttempts }" }
 *       403: { description: Khong phai quan tri vien }
 * /deliveries/{orderId}/slip:
 *   get:
 *     tags: [Deliveries]
 *     summary: "Phieu giao hang (de 14): dia chi, xa/phuong, so dien thoai, tien phai thu, ma QR (PNG data URL) chua ma van don"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: "{ trackingCode, qr, receiver, item, collect, attempts, printedAt }" }
 *       404: { description: Don khong thuoc nguoi xem }
 * /deliveries/{orderId}/start:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Quet ma kien, mang di giao: DELIVERY_ASSIGNED -> OUT_FOR_DELIVERY"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [code, lat, lng], properties: { code: { type: string, example: EXP1000000201 }, lat: { type: number }, lng: { type: number } } } } }
 *     responses:
 *       200: { description: "{ trackingCode, status: OUT_FOR_DELIVERY }" }
 *       400: { description: "Ma khong khop kien, thieu toa do" }
 *       409: { description: Don khong o buoc cho giao }
 * /deliveries/{orderId}/delivered:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Giao thanh cong (US-32) va thu tien (US-33) trong cung transaction: DELIVERED, ghi GPS, cod.collected; khong doi trang thai duoc nua"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number }
 *               lng: { type: number }
 *               collectedAmount: { type: number, description: "Bat buoc khi co tien phai thu: dung bang thu ho + phi (neu nguoi nhan tra)" }
 *               method: { type: string, enum: [CASH, TRANSFER] }
 *               txnRef: { type: string, description: "Ma giao dich khi chuyen khoan" }
 *     responses:
 *       200: { description: "{ trackingCode, status: DELIVERED, collected }" }
 *       400: { description: "Thu thieu / thua tien, thieu hinh thuc, chuyen khoan thieu ma giao dich" }
 *       409: { description: "Don khong dang giao (vd da DELIVERED)" }
 * /deliveries/{orderId}/failed:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Giao khong thanh cong (US-32): bat buoc nguyen nhan, tang so lan giao; giao lai (RESCHEDULED) hoac hoan (RETURNING) theo chinh sach (US-36)"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [reason, lat, lng], properties: { reason: { type: string, enum: [RECIPIENT_UNREACHABLE, RESCHEDULE_REQUESTED, REFUSED, WRONG_ADDRESS, RECIPIENT_ABSENT, OTHER] }, note: { type: string }, lat: { type: number }, lng: { type: number } } } } }
 *     responses:
 *       200: { description: "{ trackingCode, status: RESCHEDULED | RETURNING, attempts, maxAttempts }" }
 * /deliveries/{orderId}/handed-back:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Hoan hang (US-37): tai xe da tra kien cho nguoi gui, cho nguoi gui xac nhan"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [lat, lng], properties: { lat: { type: number }, lng: { type: number } } } } }
 *     responses:
 *       200: { description: "{ trackingCode, status: RETURNING, returnHandedAt }" }
 * /deliveries/{orderId}/confirm-return:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Nguoi gui xac nhan da nhan lai hang hoan -> RETURNED (US-37)"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: "{ trackingCode, status: RETURNED }" }
 *       409: { description: Tai xe chua tra hang }
 * /deliveries/board:
 *   get:
 *     tags: [Deliveries]
 *     summary: "Bang phan cong giao hom nay (US-35): hang cho giao/hoan, don dang giao, cho shop xac nhan hoan, tai tung nguoi theo ca"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ policy, queue, assigned, awaitingShop, shifts, shippersByRoute }" }
 *       403: { description: "Thieu quyen assignment:manage" }
 * /deliveries/auto:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Chay lai phan cong giao / hoan tu dong cho hang cho (gui nhanh truoc)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ assigned, unassigned, results }" }
 * /deliveries/assign:
 *   post:
 *     tags: [Deliveries]
 *     summary: "Dieu chinh phan cong giao / hoan tay: chon nguoi phu trach tuyen, BAT BUOC ly do"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [orderId, shipperId, reason], properties: { orderId: { type: string }, shipperId: { type: string }, reason: { type: string, example: "Tài xế cũ nghỉ, chuyển người khác" } } } } }
 *     responses:
 *       200: { description: "{ trackingCode, status, kind, shipper, overCapacity }" }
 */
export function buildDeliveryRouter({ deliveryService, middleware }) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  router.use(requireAuth);
  const run = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req)));

  router.get("/mine", run((req) => deliveryService.myDeliveries(req.user, req.query)));
  router.get("/fail-reasons", (req, res) =>
    ok(res, Object.entries(DELIVERY_FAIL_LABELS).map(([value, label]) => ({ value, label }))),
  );
  router.get("/policy", run(() => deliveryService.policy()));
  router.put("/policy", run((req) => deliveryService.setPolicy(req.user, req.body || {})));
  router.get("/:orderId/slip", run((req) => deliveryService.slip(req.user, req.params.orderId)));
  router.post("/:orderId/start", run((req) => deliveryService.startDelivery(req.user, req.params.orderId, req.body || {})));
  router.post("/:orderId/delivered", run((req) => deliveryService.confirmDelivered(req.user, req.params.orderId, req.body || {})));
  router.post("/:orderId/failed", run((req) => deliveryService.failDelivery(req.user, req.params.orderId, req.body || {})));
  router.post("/:orderId/handed-back", run((req) => deliveryService.handBack(req.user, req.params.orderId, req.body || {})));
  router.post("/:orderId/confirm-return", run((req) => deliveryService.confirmReturned(req.user, req.params.orderId)));

  router.use(requirePermission("assignment:manage"));
  router.get("/board", run((req) => deliveryService.board(req.user)));
  router.post("/auto", run((req) => deliveryService.runQueue(req.user)));
  router.post("/assign", run((req) => deliveryService.assignManually(req.user, req.body || {})));
  return router;
}
