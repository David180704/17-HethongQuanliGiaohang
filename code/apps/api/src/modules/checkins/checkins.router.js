import { Router } from "express";
import { asyncHandler, created, ok } from "../../core/response.js";
import { createCrudRouter } from "../../core/createCrudRouter.js";
import { CrudController } from "../../core/CrudController.js";
import { ErrorCodes } from "../../core/errors.js";

/**
 * @openapi
 * /checkinPoints:
 *   get:
 *     tags: [CheckinPoints]
 *     summary: "Diem check-in (US-29, ADMIN): toa do + ban kinh (mac dinh 150 m)"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach diem }
 *   post:
 *     tags: [CheckinPoints]
 *     summary: Them diem check-in
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, lat, lng]
 *             properties:
 *               code: { type: string, example: "CP-HN-01" }
 *               name: { type: string, example: "Ngã tư Xuân Thủy" }
 *               address: { type: string }
 *               lat: { type: number, example: 21.0368 }
 *               lng: { type: number, example: 105.7826 }
 *               radiusM: { type: number, example: 150 }
 *               hubId: { type: string }
 *     responses:
 *       201: { description: Tao thanh cong }
 *       400: { description: "Toa do / ban kinh ngoai mien (lat -90..90, lng -180..180, ban kinh 20..2000 m)" }
 *       409: { description: Trung ma diem }
 * /checkinPoints/{id}:
 *   get:
 *     tags: [CheckinPoints]
 *     summary: Chi tiet diem
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: OK }
 *   put:
 *     tags: [CheckinPoints]
 *     summary: Sua diem (doi toa do, ban kinh, ngung dung)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: OK }
 *   delete:
 *     tags: [CheckinPoints]
 *     summary: Xoa diem
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: OK }
 * /checkins/points:
 *   get:
 *     tags: [Checkins]
 *     summary: "Diem check-in dang dung - cho app tai xe (chon vi tri gia lap) va nhan vien"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "[{ code, name, lat, lng, radiusM }]" }
 * /checkins:
 *   post:
 *     tags: [Checkins]
 *     summary: "Tai xe gui vi tri (US-30): trong ban kinh diem nao thi ghi moc cho cac don dang cam; chan trung 30 phut"
 *     description: "Mat mang: app gui lai kem at (thoi diem goc, trong 24 gio) va clientEventId - gui lai khong ghi trung. pointId = check-in tay (cach diem <= 1 km)."
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number }
 *               lng: { type: number }
 *               at: { type: string, format: date-time }
 *               clientEventId: { type: string }
 *               pointId: { type: string, description: "Check-in tay du phong" }
 *     responses:
 *       201: { description: "{ matched: [{ code, name, distanceM }], orders, recorded, duplicates }" }
 *       403: { description: Khong phai nguoi giao hang }
 */
export function buildCheckinPointsRouter({ services, middleware }) {
  return createCrudRouter({ controller: new CrudController(services.checkinPoints), permission: "checkinPoints:manage", ...middleware });
}

export function buildCheckinsRouter({ checkinService, middleware }) {
  const { requireAuth } = middleware;
  const router = Router();
  router.use(requireAuth);
  router.get(
    "/points",
    asyncHandler(async (req, res) => {
      if (req.user.role === "CUSTOMER") throw ErrorCodes.FORBIDDEN();
      return ok(res, await checkinService.activePoints());
    }),
  );
  router.post("/", asyncHandler(async (req, res) => created(res, await checkinService.record(req.user, req.body || {}))));
  return router;
}
