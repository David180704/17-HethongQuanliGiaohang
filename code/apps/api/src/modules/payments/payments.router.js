import { Router } from "express";
import { asyncHandler, created, ok } from "../../core/response.js";

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Trang ket qua khi giao dich khong co returnTo (vd mo link thanh toan tu Swagger). */
function resultPage(payment, response) {
  const title = !payment ? "Không xác định được giao dịch" : payment.status === "SUCCESS" ? "Thanh toán thành công" : "Thanh toán chưa thành công";
  const detail = payment ? `Đơn ${payment.trackingCode} · ${payment.amount.toLocaleString("vi-VN")} đ · mã ${response.RspCode}` : response.Message;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head><body style="font-family:system-ui;padding:24px"><h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(detail)}</p><p>Bạn có thể đóng trang này và quay lại ứng dụng EDMS.</p></body></html>`;
}

/**
 * @openapi
 * /payments/vnpay:
 *   post:
 *     tags: [Payments]
 *     summary: "Khach tao giao dich thanh toan phi van chuyen qua VNPay (US-44) - don cua minh, nguoi gui tra truoc bang VNPAY, chua tra"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId]
 *             properties:
 *               orderId: { type: string }
 *               client: { type: string, enum: [WEB, MOBILE], default: WEB }
 *               returnTo: { type: string, example: "http://localhost:5173/don-hang/665f...", description: "Web: thuoc CORS_ORIGIN; app: edmskh://..., exp://..." }
 *     responses:
 *       201: { description: "{ txnRef, amount, status: PENDING, expiresAt, paymentUrl } - mo paymentUrl de sang trang VNPay" }
 *       409: { description: Don da thanh toan }
 *       503: { description: May chu chua cau hinh VNPAY_TMN_CODE / VNPAY_HASH_SECRET }
 * /payments/vnpay/ipn:
 *   get:
 *     tags: [Payments]
 *     summary: "VNPay goi (may chu -> may chu) bao ket qua giao dich; kiem chu ky HMAC-SHA512, xu ly dung mot lan"
 *     responses:
 *       200: { description: "{ RspCode: 00 | 01 | 02 | 04 | 97 | 99, Message }" }
 * /payments/vnpay/return:
 *   get:
 *     tags: [Payments]
 *     summary: "VNPay chuyen trinh duyet ve day; API ghi ket qua (neu IPN chua toi) roi chuyen ve returnTo cua app"
 *     responses:
 *       302: { description: "Ve returnTo kem ?thanhToan=SUCCESS|FAILED&maGiaoDich=..." }
 *       200: { description: Trang ket qua khi giao dich khong co returnTo }
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: Lich su thanh toan cua mot don (theo pham vi xem don)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: orderId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: "[{ txnRef, amount, status, statusLabel, paidAt, bankCode, transactionNo }]" }
 */
export function buildPaymentsRouter({ paymentService, middleware }) {
  const { requireAuth } = middleware;
  const router = Router();

  // Hai duong dan VNPay goi khong co token: tin cay nho chu ky HMAC
  router.get(
    "/vnpay/ipn",
    asyncHandler(async (req, res) => {
      const { response } = await paymentService.handleVnpayResult(req.query);
      res.json(response);
    }),
  );
  router.get(
    "/vnpay/return",
    asyncHandler(async (req, res) => {
      const { response, payment } = await paymentService.handleVnpayResult(req.query);
      const target = paymentService.resultRedirect(payment, response);
      if (target) return res.redirect(302, target);
      res.type("html").send(resultPage(payment, response));
    }),
  );

  router.use(requireAuth);
  router.post(
    "/vnpay",
    asyncHandler(async (req, res) => created(res, await paymentService.createVnpay(req.user, req.body || {}, req.ip))),
  );
  router.get("/", asyncHandler(async (req, res) => ok(res, await paymentService.listForOrder(req.user, req.query.orderId))));
  return router;
}
