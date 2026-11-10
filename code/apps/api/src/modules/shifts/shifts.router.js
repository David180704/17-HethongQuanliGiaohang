import { Router } from "express";
import { asyncHandler, created, ok } from "../../core/response.js";

/**
 * @openapi
 * /shifts:
 *   get:
 *     tags: [Shifts]
 *     summary: "Ca lam viec (US-23) - nhan vien kho: ca cua cac tuyen thuoc hub minh va buu cuc truc thuoc; admin: tat ca"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: date, schema: { type: string, example: "2026-11-12" }, description: "Ngay lam viec YYYY-MM-DD" }
 *       - { in: query, name: routeId, schema: { type: string } }
 *     responses:
 *       200: { description: "Danh sach ca kem routeId { code, name }, shipperIds [{ fullName, phone }]" }
 *   post:
 *     tags: [Shifts]
 *     summary: "Tao ca: tuyen trong pham vi, nguoi giao hang phu trach tuyen do, khong trung gio voi ca khac cung ngay"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [routeId, name, shiftDate, startTime, endTime]
 *             properties:
 *               routeId: { type: string }
 *               name: { type: string, example: "Ca sáng" }
 *               shiftDate: { type: string, example: "2026-11-12" }
 *               startTime: { type: string, example: "08:00" }
 *               endTime: { type: string, example: "12:00" }
 *               shipperIds: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: "Ca da tao, ma <tuyen>-<YYYYMMDD>-<HHmm>" }
 *       400: { description: "Gio sai, ket thuc truoc bat dau, nguoi khong phu trach tuyen" }
 *       404: { description: Tuyen ngoai pham vi }
 *       409: { description: "Trung ca: cung tuyen cung gio bat dau, hoac nguoi giao hang da co ca trung gio" }
 * /shifts/mine:
 *   get:
 *     tags: [Shifts]
 *     summary: "Nguoi giao hang xem ca cua minh trong ngay (mac dinh hom nay)"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: query, name: date, schema: { type: string, example: "2026-11-12" } }]
 *     responses:
 *       200: { description: "Ca co ten nguoi nay, kem tuyen" }
 *       403: { description: Khong phai nguoi giao hang }
 * /shifts/options:
 *   get:
 *     tags: [Shifts]
 *     summary: "Lua chon cho form ca: tuyen trong pham vi kem nguoi giao hang dang phu trach tung tuyen"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ routes: [{ _id, code, name, shippers: [{ _id, fullName, phone }] }] }" }
 * /shifts/{id}:
 *   put:
 *     tags: [Shifts]
 *     summary: "Sua ca (doi gio, them / bot nguoi giao hang) - cung rang buoc nhu tao"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Ca da sua }
 *   delete:
 *     tags: [Shifts]
 *     summary: Xoa ca
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: "{ deleted: true }" }
 */
export function buildShiftsRouter({ shiftService, middleware }) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  router.use(requireAuth);
  router.get("/mine", asyncHandler(async (req, res) => ok(res, await shiftService.mine(req.user, req.query))));
  router.use(requirePermission("shift:manage"));
  // Controller mong: chi dich HTTP, kem nguoi dung tu token (pham vi theo hub)
  router.get("/options", asyncHandler(async (req, res) => ok(res, await shiftService.options(req.user))));
  router.get("/", asyncHandler(async (req, res) => ok(res, await shiftService.list(req.user, req.query))));
  router.post("/", asyncHandler(async (req, res) => created(res, await shiftService.create(req.user, req.body || {}))));
  router.put("/:id", asyncHandler(async (req, res) => ok(res, await shiftService.update(req.user, req.params.id, req.body || {}))));
  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      await shiftService.remove(req.user, req.params.id);
      return ok(res, { deleted: true });
    }),
  );
  return router;
}
