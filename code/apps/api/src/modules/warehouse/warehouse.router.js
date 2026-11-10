import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";
import { ITEM_CATEGORY_LABELS } from "./warehouse.js";

/**
 * @openapi
 * /warehouse/orders/{code}:
 *   get:
 *     tags: [Warehouse]
 *     summary: "Quet ma van don tai kho (US-41): thong tin don va buoc tiep theo nhan vien nay lam duoc"
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: code, required: true, schema: { type: string, example: "EXP1000000123" } }]
 *     responses:
 *       200: { description: "{ trackingCode, status, pickupHub, currentHub, destHub, action: RECEIVE|RECEIVE_DEST|SORT|DISPATCH|null, actionLabel, reason }" }
 *       400: { description: Ma khong dung dang EXP + 10 chu so }
 *       403: { description: Khong phai nhan vien kho }
 *       404: { description: Khong tim thay don }
 * /warehouse/receive:
 *   post:
 *     tags: [Warehouse]
 *     summary: "Nhan vao kho: PICKED_UP -> AT_HUB (kho lay hang) hoac IN_TRANSIT -> AT_DEST_HUB (kho dich); ghi nhan vien, thoi gian"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [trackingCode], properties: { trackingCode: { type: string } } } } }
 *     responses:
 *       200: { description: Don sau khi nhan kho }
 *       409: { description: "Don khong o buoc nhan kho hoac thuoc kho khac" }
 * /warehouse/sort:
 *   post:
 *     tags: [Warehouse]
 *     summary: "Phan loai theo loai hang (danh sach co dinh de 14) va tuyen: AT_HUB -> SORTED"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trackingCode, category]
 *             properties:
 *               trackingCode: { type: string }
 *               category: { type: string, enum: [SMALL_PARCEL, BAG, CARTON, TV, LAPTOP, CPU, VEHICLE, OTHER] }
 *     responses:
 *       200: { description: Don da phan loai }
 *       400: { description: Thieu loai hang }
 * /warehouse/dispatch:
 *   post:
 *     tags: [Warehouse]
 *     summary: "Xuat kho len chang sau: SORTED -> IN_TRANSIT (di kho dich)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { type: object, required: [trackingCode], properties: { trackingCode: { type: string } } } } }
 *     responses:
 *       200: { description: Don dang trung chuyen }
 * /warehouse/stock:
 *   get:
 *     tags: [Warehouse]
 *     summary: "Ton kho cua hub (va buu cuc truc thuoc): so don theo trang thai, theo loai hang; hang sap toi"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ counts: { AT_HUB, SORTED, AT_DEST_HUB, incoming }, byCategory, orders, incoming }" }
 * /warehouse/categories:
 *   get:
 *     tags: [Warehouse]
 *     summary: "Danh sach loai hang [{ code, label }]"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
export function buildWarehouseRouter({ warehouseService, middleware }) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  // Nhan vien kho (quyen xu ly don tai diem - order:approve); service kiem them vai tro va hub
  router.use(requireAuth, requirePermission("order:approve"));
  router.get("/categories", (req, res) => ok(res, Object.entries(ITEM_CATEGORY_LABELS).map(([code, label]) => ({ code, label }))));
  router.get("/stock", asyncHandler(async (req, res) => ok(res, await warehouseService.stock(req.user))));
  router.get("/orders/:code", asyncHandler(async (req, res) => ok(res, await warehouseService.lookup(req.user, req.params.code))));
  router.post("/receive", asyncHandler(async (req, res) => ok(res, await warehouseService.receive(req.user, req.body || {}))));
  router.post("/sort", asyncHandler(async (req, res) => ok(res, await warehouseService.sort(req.user, req.body || {}))));
  router.post("/dispatch", asyncHandler(async (req, res) => ok(res, await warehouseService.dispatch(req.user, req.body || {}))));
  return router;
}
