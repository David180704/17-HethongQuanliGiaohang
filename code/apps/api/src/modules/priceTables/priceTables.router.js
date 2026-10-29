import { createCrudRouter } from "../../core/createCrudRouter.js";
import { CrudController } from "../../core/CrudController.js";

/**
 * @openapi
 * components:
 *   schemas:
 *     WeightTier:
 *       type: object
 *       description: Bac khoi luong, ap dung khi fromGram <= khoi luong < toGram
 *       properties:
 *         fromGram: { type: number, example: 0 }
 *         toGram: { type: number, example: 500 }
 *         basePrice: { type: number, example: 15000 }
 *         pricePer500g: { type: number, example: 3000 }
 *     PriceTableInput:
 *       type: object
 *       required: [serviceTypeId, zone, weightTiers, effectiveFrom]
 *       properties:
 *         serviceTypeId: { type: string }
 *         zone: { type: string, enum: [INNER_DISTRICT, INNER_PROVINCE, INTER_PROVINCE, INTER_REGION] }
 *         weightTiers: { type: array, items: { $ref: "#/components/schemas/WeightTier" } }
 *         effectiveFrom: { type: string, format: date, example: "2027-01-01" }
 *         effectiveTo: { type: string, format: date, nullable: true }
 *         isActive: { type: boolean }
 * /priceTables:
 *   get:
 *     tags: [PriceTables]
 *     summary: Danh sach bang gia (ADMIN), loc ?serviceTypeId=&zone=
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach bang gia kem ten loai dich vu }
 *   post:
 *     tags: [PriceTables]
 *     summary: Tao bang gia - bac khong chong lan/khong ho, khong trung khoang hieu luc
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content: { application/json: { schema: { $ref: "#/components/schemas/PriceTableInput" } } }
 *     responses:
 *       201: { description: Tao thanh cong }
 *       400: { description: Bac khoi luong chong lan, ho khoang trong hoac du lieu sai }
 *       409: { description: Trung khoang hieu luc voi bang gia cung dich vu va vung }
 * /priceTables/{id}:
 *   get:
 *     tags: [PriceTables]
 *     summary: Chi tiet bang gia
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet bang gia }
 *   put:
 *     tags: [PriceTables]
 *     summary: Sua bang gia (da dung cho don hang thi chi lui duoc effectiveTo)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *       409: { description: Bang gia da dung hoac trung khoang hieu luc }
 *   delete:
 *     tags: [PriceTables]
 *     summary: Xoa bang gia (chan neu da dung cho don hang)
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da xoa }
 *       409: { description: Da dung cho don hang, chi lui duoc effectiveTo }
 */

export function buildPriceTablesRouter({ services, middleware }) {
  return createCrudRouter({
    controller: new CrudController(services.priceTables),
    permission: "priceTables:manage",
    ...middleware,
  });
}
