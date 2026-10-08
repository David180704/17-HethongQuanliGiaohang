import { crudRouter } from "../../core/crudRouter.js";
import { ServiceType } from "../../models/ServiceType.js";
import { PriceTable } from "../../models/PriceTable.js";
import { ErrorCodes } from "../../core/errors.js";
import { createServiceTypeSchema, updateServiceTypeSchema } from "./serviceTypes.schema.js";

/**
 * @openapi
 * /serviceTypes:
 *   get:
 *     tags: [ServiceTypes]
 *     summary: Danh sach loai dich vu (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach loai dich vu }
 *   post:
 *     tags: [ServiceTypes]
 *     summary: Tao loai dich vu (STANDARD/EXPRESS)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tao thanh cong }
 * /serviceTypes/{id}:
 *   get:
 *     tags: [ServiceTypes]
 *     summary: Chi tiet mot loai dich vu
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet loai dich vu }
 *   put:
 *     tags: [ServiceTypes]
 *     summary: Cap nhat loai dich vu
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *   delete:
 *     tags: [ServiceTypes]
 *     summary: Xoa loai dich vu (chan neu da dung trong bang gia)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da xoa }
 *       409: { description: Dang duoc dung trong bang gia, khong xoa duoc }
 */

export const serviceTypesRouter = crudRouter({
  model: ServiceType,
  resource: "serviceTypes",
  createSchema: createServiceTypeSchema,
  updateSchema: updateServiceTypeSchema,
  searchFields: ["code", "name"],
  beforeDelete: async (item) => {
    const usedInPriceTable = await PriceTable.exists({ serviceTypeId: item._id });
    if (usedInPriceTable) {
      throw ErrorCodes.CONFLICT("Loai dich vu dang duoc dung trong bang gia, khong the xoa");
    }
  },
});
