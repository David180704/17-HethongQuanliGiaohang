import { Router } from "express";
import { asyncHandler } from "../../core/response.js";
import { PickupLocationController } from "./PickupLocationController.js";

/**
 * @openapi
 * components:
 *   schemas:
 *     PickupLocationInput:
 *       type: object
 *       required: [label, contactName, contactPhone, address, province, ward]
 *       properties:
 *         label: { type: string, example: "Kho Cầu Giấy" }
 *         contactName: { type: string, example: "Nguyễn Văn A" }
 *         contactPhone: { type: string, example: "0909123456" }
 *         address: { type: string, example: "12 Trần Thái Tông" }
 *         province: { type: string, example: "Hà Nội" }
 *         ward: { type: string, example: "Phường Cầu Giấy", description: "Xa/phuong thuoc dung tinh va dang phuc vu; server tu gan serviceAreaId" }
 *         isDefault: { type: boolean }
 * /pickupLocations:
 *   get:
 *     tags: [PickupLocations]
 *     summary: Dia diem lay hang cua chinh khach dang dang nhap (mac dinh dung dau), meta.max = 10
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach dia diem dang dung }
 *   post:
 *     tags: [PickupLocations]
 *     summary: Them dia diem - toi da 10, tu xac dinh khu vuc phuc vu, dia diem dau tien la mac dinh
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: "#/components/schemas/PickupLocationInput" } } }
 *     responses:
 *       201: { description: Da them, kem serviceAreaId }
 *       400: { description: Thieu thong tin hoac so dien thoai sai }
 *       409: { description: PICKUP_LOCATION_LIMIT - da du 10 dia diem }
 *       422: { description: OUT_OF_SERVICE_AREA - quan/huyen chua thuoc vung phuc vu }
 * /pickupLocations/{id}:
 *   get:
 *     tags: [PickupLocations]
 *     summary: Chi tiet mot dia diem cua minh (dia diem cua nguoi khac -> 404)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet }
 *       404: { description: Khong co hoac khong phai cua minh }
 *   put:
 *     tags: [PickupLocations]
 *     summary: Sua dia diem / dat lam mac dinh (con don chua hoan tat thi khong doi dia chi)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *       409: { description: Dia diem dang co don chua hoan tat }
 *       422: { description: OUT_OF_SERVICE_AREA }
 *   delete:
 *     tags: [PickupLocations]
 *     summary: Xoa dia diem - chan khi con don chua hoan tat; xoa dia diem mac dinh thi dia diem moi nhat thanh mac dinh
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da xoa }
 *       409: { description: Con don chua hoan tat }
 */

// Khong dung createCrudRouter: moi thao tac gan voi chu so huu (req.user.id), khong phai danh muc chung.
export function buildPickupLocationsRouter({ services, middleware }) {
  const controller = new PickupLocationController(services.pickupLocations);
  const router = Router();
  router.use(middleware.requireAuth, middleware.requirePermission("pickupLocation:manage:own"));

  router.get("/", asyncHandler(controller.list));
  router.get("/:id", asyncHandler(controller.get));
  router.post("/", asyncHandler(controller.create));
  router.put("/:id", asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.remove));
  return router;
}
