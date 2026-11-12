import { Router } from "express";
import { asyncHandler, created, ok } from "../../core/response.js";
import { INCIDENT_TYPE_LABELS } from "./IncidentService.js";

/**
 * @openapi
 * /incidents:
 *   get:
 *     tags: [Incidents]
 *     summary: "Su co, khieu nai (US-38) trong pham vi: shop - don cua minh; kho - don thuoc kho; tai xe - su co minh bao; admin - tat ca"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, IN_PROGRESS, RESOLVED] } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: orderId, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string }, description: "Ma su co, ma van don, noi dung" }
 *     responses:
 *       200: { description: "Phan trang: items [{ code, trackingCode, typeLabel, statusLabel, description, history, resolution }]" }
 *   post:
 *     tags: [Incidents]
 *     summary: "Ghi nhan su co / khieu nai o moi thoi diem: don chua ket thuc chuyen INCIDENT (dung giao nhan) toi khi giai quyet"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, description]
 *             properties:
 *               orderId: { type: string }
 *               trackingCode: { type: string, example: EXP1000000005 }
 *               type: { type: string, enum: [LOST, DAMAGED, WRONG_INFO, SHOP_COMPLAINT, RECIPIENT_COMPLAINT, OTHER] }
 *               source: { type: string, enum: [SHOP, RECIPIENT, STAFF], description: "Chi nhan vien chon (ghi ho nguoi nhan goi tong dai)" }
 *               description: { type: string, example: "Thùng hàng móp méo, vỡ 2 cốc thủy tinh" }
 *     responses:
 *       201: { description: "{ code: SC000001, status: OPEN, orderStatusBefore }" }
 *       404: { description: Don khong thuoc pham vi }
 * /incidents/types:
 *   get:
 *     tags: [Incidents]
 *     summary: Loai su co
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "[{ value, label }]" }
 * /incidents/{id}:
 *   get:
 *     tags: [Incidents]
 *     summary: Chi tiet su co kem lich su xu ly
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Su co }
 * /incidents/{id}/progress:
 *   post:
 *     tags: [Incidents]
 *     summary: "Kho / admin ghi tien do xu ly -> IN_PROGRESS"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [note], properties: { note: { type: string } } } } }
 *     responses:
 *       200: { description: Su co dang xu ly }
 * /incidents/{id}/resolve:
 *   post:
 *     tags: [Incidents]
 *     summary: "Kho / admin giai quyet: ket qua, boi thuong (dong); het su co mo thi don tra lai trang thai truoc su co"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [result], properties: { result: { type: string }, compensation: { type: integer, example: 150000 } } } } }
 *     responses:
 *       200: { description: Su co da giai quyet }
 *       409: { description: Da giai quyet truoc do }
 */
export function buildIncidentsRouter({ incidentService, middleware }) {
  const { requireAuth } = middleware;
  const router = Router();
  router.use(requireAuth);
  router.get("/types", (req, res) => ok(res, Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))));
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const { items, ...meta } = await incidentService.list(req.user, req.query);
      return ok(res, items, meta);
    }),
  );
  router.post("/", asyncHandler(async (req, res) => created(res, await incidentService.create(req.user, req.body || {}))));
  router.get("/:id", asyncHandler(async (req, res) => ok(res, await incidentService.get(req.user, req.params.id))));
  router.post("/:id/progress", asyncHandler(async (req, res) => ok(res, await incidentService.progress(req.user, req.params.id, req.body || {}))));
  router.post("/:id/resolve", asyncHandler(async (req, res) => ok(res, await incidentService.resolve(req.user, req.params.id, req.body || {}))));
  return router;
}
