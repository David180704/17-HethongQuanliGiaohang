import { createCrudRouter } from "../../core/createCrudRouter.js";
import { CrudController } from "../../core/CrudController.js";

/**
 * @openapi
 * components:
 *   schemas:
 *     HubInput:
 *       type: object
 *       required: [code, name, type, province, ward]
 *       properties:
 *         code: { type: string, example: "PO-HN-CG" }
 *         name: { type: string, example: "Bưu cục Cầu Giấy" }
 *         type: { type: string, enum: [HUB, POST_OFFICE], description: "HUB = diem tap ket, POST_OFFICE = buu cuc" }
 *         parentHubId: { type: string, nullable: true, description: "Bat buoc voi POST_OFFICE, phai la mot HUB" }
 *         address: { type: string }
 *         province: { type: string, example: "Hà Nội" }
 *         ward: { type: string, example: "Phường Cầu Giấy", description: "Xa/phuong thuoc dung tinh (danh muc hanh chinh 2025) va dang phuc vu; server tu gan serviceAreaId" }
 *         isActive: { type: boolean }
 * /hubs:
 *   get:
 *     tags: [Hubs]
 *     summary: Danh sach diem tap ket va buu cuc (ADMIN), loc ?type=&parentHubId=&province=
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach kem ma/ten hub cap tren }
 *   post:
 *     tags: [Hubs]
 *     summary: Tao diem - buu cuc phai truc thuoc mot HUB, quan/huyen phai thuoc vung phuc vu
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: "#/components/schemas/HubInput" } } }
 *     responses:
 *       201: { description: Tao thanh cong, da gan serviceAreaId }
 *       400: { description: Thieu du lieu, buu cuc khong co cap tren hoac cap tren khong phai HUB }
 *       409: { description: Trung ma diem }
 *       422: { description: OUT_OF_SERVICE_AREA - quan/huyen chua thuoc vung phuc vu }
 * /hubs/{id}:
 *   get:
 *     tags: [Hubs]
 *     summary: Chi tiet mot diem
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet diem }
 *   put:
 *     tags: [Hubs]
 *     summary: Sua diem (khong doi ma); doi quan/huyen thi gan lai khu vuc phuc vu
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *       409: { description: Hub con buu cuc truc thuoc ma doi thanh buu cuc }
 *       422: { description: OUT_OF_SERVICE_AREA }
 *   delete:
 *     tags: [Hubs]
 *     summary: Xoa diem - chan khi con tuyen, nhan vien hoac buu cuc truc thuoc
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da xoa }
 *       409: { description: Diem dang duoc dung }
 */

export function buildHubsRouter({ services, middleware }) {
  return createCrudRouter({ controller: new CrudController(services.hubs), permission: "hubs:manage", ...middleware });
}
