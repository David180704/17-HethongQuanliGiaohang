import { crudRouter } from "../../core/crudRouter.js";
import { ServiceArea } from "../../models/ServiceArea.js";
import { createServiceAreaSchema, updateServiceAreaSchema } from "./serviceAreas.schema.js";

/**
 * @openapi
 * /serviceAreas:
 *   get:
 *     tags: [ServiceAreas]
 *     summary: Danh sach khu vuc phuc vu (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach khu vuc }
 *   post:
 *     tags: [ServiceAreas]
 *     summary: Them khu vuc (mot quan/huyen chi thuoc mot tuyen)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tao thanh cong }
 *       409: { description: Quan/huyen da thuoc tuyen khac }
 * /serviceAreas/{id}:
 *   get:
 *     tags: [ServiceAreas]
 *     summary: Chi tiet mot khu vuc
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet khu vuc }
 *   put:
 *     tags: [ServiceAreas]
 *     summary: Doi tuyen/mien/danh sach phuong xa (khong doi province/district)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *   delete:
 *     tags: [ServiceAreas]
 *     summary: Xoa khu vuc
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da xoa }
 */

export const serviceAreasRouter = crudRouter({
  model: ServiceArea,
  resource: "serviceAreas",
  createSchema: createServiceAreaSchema,
  updateSchema: updateServiceAreaSchema,
  searchFields: ["province", "district"],
});
