import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";

/**
 * @openapi
 * /capacity:
 *   get:
 *     tags: [Capacity]
 *     summary: "Nang luc moi ca (US-24): mac dinh he thong + tung tuyen trong pham vi kem nang luc hieu luc cua tung nguoi giao hang"
 *     description: "Thu tu uu tien: rieng nguoi giao hang -> tuyen -> mac dinh he thong. source = USER | ROUTE | SYSTEM."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ system: { maxPickupPerShift, maxDeliveryPerShift }, routes: [{ code, maxPickupPerShift, shippers: [{ fullName, pickup: { value, source }, delivery }] }] }" }
 *       403: { description: "Thieu quyen assignment:manage" }
 * /capacity/system:
 *   put:
 *     tags: [Capacity]
 *     summary: "Doi nang luc mac dinh he thong (chi quan tri vien)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxPickupPerShift: { type: integer, minimum: 1, maximum: 500, example: 20 }
 *               maxDeliveryPerShift: { type: integer, minimum: 1, maximum: 500, example: 30 }
 *     responses:
 *       200: { description: Mac dinh moi }
 *       400: { description: "Khong phai so nguyen 1..500" }
 *       403: { description: Khong phai quan tri vien }
 * /capacity/routes/{id}:
 *   put:
 *     tags: [Capacity]
 *     summary: "Doi nang luc cua tuyen (nhan vien kho: tuyen thuoc hub minh)"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxPickupPerShift: { type: integer, example: 15 }
 *               maxDeliveryPerShift: { type: integer, example: 25 }
 *     responses:
 *       200: { description: Tuyen da cap nhat }
 *       404: { description: Tuyen ngoai pham vi }
 * /capacity/shippers/{id}:
 *   put:
 *     tags: [Capacity]
 *     summary: "Nang luc rieng cua nguoi giao hang; gui null de bo ghi de (dung nang luc tuyen)"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxPickupPerShift: { type: integer, nullable: true, example: 8 }
 *               maxDeliveryPerShift: { type: integer, nullable: true, example: null }
 *     responses:
 *       200: { description: Nguoi giao hang da cap nhat }
 *       404: { description: Nguoi giao hang khong thuoc tuyen cua diem }
 */
export function buildCapacityRouter({ capacityService, middleware }) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  router.use(requireAuth);
  // Mac dinh he thong: quyen rieng ma chi ADMIN ("*") co
  router.put(
    "/system",
    requirePermission("capacity:system"),
    asyncHandler(async (req, res) => ok(res, await capacityService.updateSystem(req.user, req.body || {}))),
  );
  router.use(requirePermission("assignment:manage"));
  router.get("/", asyncHandler(async (req, res) => ok(res, await capacityService.overview(req.user))));
  router.put(
    "/routes/:id",
    asyncHandler(async (req, res) => ok(res, await capacityService.updateRoute(req.user, req.params.id, req.body || {}))),
  );
  router.put(
    "/shippers/:id",
    asyncHandler(async (req, res) => ok(res, await capacityService.updateShipper(req.user, req.params.id, req.body || {}))),
  );
  return router;
}
