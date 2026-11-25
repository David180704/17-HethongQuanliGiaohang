import { Router } from "express";
import { asyncHandler, created, ok } from "../../core/response.js";

/**
 * @openapi
 * /settlements:
 *   get:
 *     tags: [Settlements]
 *     summary: "Ky doi soat (US-43): shop - cua minh; quan tri vien - tat ca (loc shop, trang thai)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [PENDING, PAID] } }
 *       - { in: query, name: customerId, schema: { type: string } }
 *     responses:
 *       200: { description: "items [{ code, customerName, periodFrom, periodTo, status, totals: { orders, cod, feeDeducted, adjustments, netPayable }, payment }]" }
 *   post:
 *     tags: [Settlements]
 *     summary: "US-34: lap ky doi soat cho moi shop co don da giao / da hoan trong khoang [from, to] chua doi soat (mot transaction / shop)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [from, to], properties: { from: { type: string, example: "2026-11-01" }, to: { type: string, example: "2026-11-15" }, customerId: { type: string } } } } }
 *     responses:
 *       201: { description: "Cac ky vua lap" }
 *       400: { description: "Ngay sai, khong co don nao trong ky" }
 *       403: { description: Khong phai quan tri vien }
 *       409: { description: "Don vua vao ky khac (chay dong thoi)" }
 * /settlements/preview:
 *   post:
 *     tags: [Settlements]
 *     summary: "Xem truoc doi soat: tung shop bao nhieu don, tong thu ho, phi khau tru, so tien tra (chua ghi)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [from, to], properties: { from: { type: string }, to: { type: string } } } } }
 *     responses:
 *       200: { description: "[{ customerName, totals }]" }
 * /settlements/{id}:
 *   get:
 *     tags: [Settlements]
 *     summary: "Chi tiet ky: tung don (thu ho, phi, khau tru), khoan dieu chinh, giao dich chi tra"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Ky doi soat }
 *       404: { description: Khong thuoc shop }
 * /settlements/{id}/adjustments:
 *   post:
 *     tags: [Settlements]
 *     summary: "US-43 (PB#76): them khoan dieu chinh (+ cong cho shop, - tru) khi ky con cho chi tra; tinh lai so tien"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [amount, reason], properties: { amount: { type: integer, example: -20000 }, reason: { type: string, example: "Phí lưu kho quá hạn" } } } } }
 *     responses:
 *       200: { description: Ky sau dieu chinh }
 *       409: { description: Ky da chi tra }
 * /settlements/{id}/pay:
 *   post:
 *     tags: [Settlements]
 *     summary: "US-43: ghi nhan da chuyen tien vao tai khoan ngan hang shop da khai bao (US-42) -> PAID"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [txnRef], properties: { txnRef: { type: string, example: "FT26111500123" } } } } }
 *     responses:
 *       200: { description: "Ky da chi tra: payment { amount, bankName, accountNumber, txnRef, paidAt }" }
 *       409: { description: "Da chi tra, shop chua khai bao tai khoan ngan hang" }
 */
export function buildSettlementsRouter({ settlementService, middleware }) {
  const { requireAuth } = middleware;
  const router = Router();
  router.use(requireAuth);
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, ...meta } = await settlementService.list(req.user, req.query);
      return ok(res, items, meta);
    }),
  );
  router.post("/", asyncHandler(async (req, res) => created(res, await settlementService.run(req.user, req.body || {}))));
  router.post("/preview", asyncHandler(async (req, res) => ok(res, await settlementService.preview(req.user, req.body || {}))));
  router.get("/:id", asyncHandler(async (req, res) => ok(res, await settlementService.get(req.user, req.params.id))));
  router.post("/:id/adjustments", asyncHandler(async (req, res) => ok(res, await settlementService.addAdjustment(req.user, req.params.id, req.body || {}))));
  router.post("/:id/pay", asyncHandler(async (req, res) => ok(res, await settlementService.pay(req.user, req.params.id, req.body || {}))));
  return router;
}
