import { Router } from "express";
import { asyncHandler, created, ok } from "../../core/response.js";

/**
 * @openapi
 * /assignments/pickup:
 *   get:
 *     tags: [Assignments]
 *     summary: "Bang phan cong lay hang hom nay (US-25): hang cho chua phan cong, don da phan cong, tai tung nguoi theo ca"
 *     description: "Nhan vien kho: don va tuyen thuoc hub minh + buu cuc truc thuoc; admin: tat ca."
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ queue: [{ trackingCode, route, unassignedReason }], assigned: [...], shifts: [{ code, shippers: [{ fullName, used, pending, capacity }] }], shippersByRoute }" }
 *       403: { description: "Thieu quyen assignment:manage" }
 *   post:
 *     tags: [Assignments]
 *     summary: "Dieu chinh phan cong tay: chon nguoi giao hang phu trach tuyen, BAT BUOC ly do; phan cong cu bi huy"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, shipperId, reason]
 *             properties:
 *               orderId: { type: string }
 *               shipperId: { type: string }
 *               reason: { type: string, example: "Tài xế cũ nghỉ ốm, chuyển người khác" }
 *     responses:
 *       201: { description: "{ trackingCode, status: PICKUP_ASSIGNED, shipper, shift, overCapacity, load, capacity }" }
 *       400: { description: "Thieu ly do (it nhat 5 ky tu), nguoi khong phu trach tuyen" }
 *       404: { description: Don ngoai pham vi }
 *       409: { description: "Don khong con cho lay hang, da giao cho chinh nguoi nay, hoac vua bi nguoi khac doi" }
 * /assignments/pickup/auto:
 *   post:
 *     tags: [Assignments]
 *     summary: "Chay lai phan cong tu dong cho hang cho (vd vua them ca, tang nang luc)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ assigned, unassigned, results }" }
 * /assignments/mine/pickups:
 *   get:
 *     tags: [Assignments]
 *     summary: "Nguoi giao hang: don can lay hom nay, mac dinh loc theo ca hien tai (US-27)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: shiftId, schema: { type: string }, description: "Id ca, hoac 'all' de xem ca ngay" }
 *     responses:
 *       200: { description: "{ shifts, currentShiftId, selectedShiftId, counts: { total, toPick, done, failed }, orders: [{ trackingCode, pickup: { contactName, contactPhone, address }, item }] }" }
 *       403: { description: Khong phai nguoi giao hang }
 */
export function buildAssignmentsRouter({ assignmentService, middleware }) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  router.use(requireAuth);
  router.get("/mine/pickups", asyncHandler(async (req, res) => ok(res, await assignmentService.myPickups(req.user, req.query))));
  router.use(requirePermission("assignment:manage"));
  router.get("/pickup", asyncHandler(async (req, res) => ok(res, await assignmentService.pickupBoard(req.user))));
  router.post("/pickup/auto", asyncHandler(async (req, res) => ok(res, await assignmentService.runQueue(req.user))));
  router.post(
    "/pickup",
    asyncHandler(async (req, res) => created(res, await assignmentService.assignPickupManually(req.user, req.body || {}))),
  );
  return router;
}
