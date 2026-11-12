import { Router } from "express";
import { asyncHandler } from "../../core/response.js";
import { OrderDraftController } from "./OrderDraftController.js";

/**
 * @openapi
 * /orderDrafts:
 *   post:
 *     tags: [OrderDrafts]
 *     summary: Luu nhap don dang nhap do (khong can dang nhap) - tra draftToken, song 24 gio
 *     description: Da dang nhap bang tai khoan khach hang thi nhap thuoc ve khach do ngay.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payload]
 *             properties:
 *               payload: { type: object, description: "Du lieu form tao don dang nhap (toi da 20 KB)" }
 *     responses:
 *       201: { description: "{ draftToken, payload, claimed, expiresAt }" }
 *       400: { description: payload khong phai object, qua lon hoac co truong "$..." }
 * /orderDrafts/{token}:
 *   get:
 *     tags: [OrderDrafts]
 *     summary: Mo lai nhap theo draftToken; khach da dang nhap mo nhap chua co chu -> nhap thuoc ve khach do
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Du lieu da nhap con nguyen }
 *       404: { description: Het han (24 gio), khong ton tai hoac la nhap cua khach khac }
 *   put:
 *     tags: [OrderDrafts]
 *     summary: Cap nhat noi dung nhap (cung quy tac chu so huu nhu GET)
 *     parameters: [{ in: path, name: token, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da luu }
 *       404: { description: Het han hoac khong phai nhap cua minh }
 */

// Cong khai (khach vang lai dung duoc); optionalAuth de biet khach nao dang dang nhap.
export function buildOrderDraftsRouter({ orderDraftService, middleware }) {
  const controller = new OrderDraftController(orderDraftService);
  const router = Router();
  router.use(middleware.optionalAuth);
  router.post("/", asyncHandler(controller.create));
  router.get("/:token", asyncHandler(controller.get));
  router.put("/:token", asyncHandler(controller.update));
  return router;
}
