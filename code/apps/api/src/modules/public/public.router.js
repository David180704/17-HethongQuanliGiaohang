import { Router } from "express";
import { asyncHandler } from "../../core/response.js";
import { PublicController } from "./PublicController.js";

/**
 * @openapi
 * /public/service-types:
 *   get:
 *     tags: [Public]
 *     summary: Loai dich vu dang hoat dong (khong can dang nhap, cache 30 giay)
 *     responses:
 *       200: { description: "Danh sach loai dich vu. Header X-Cache: HIT | MISS" }
 * /public/service-areas:
 *   get:
 *     tags: [Public]
 *     summary: Vung phuc vu (khong can dang nhap), tim theo tinh/quan, cache 30 giay
 *     parameters: [{ in: query, name: search, schema: { type: string } }]
 *     responses:
 *       200: { description: "Danh sach quan/huyen dang phuc vu. Header X-Cache: HIT | MISS" }
 * /public/price-tables:
 *   get:
 *     tags: [Public]
 *     summary: Bang gia dang hieu luc (khong can dang nhap, cache 30 giay)
 *     responses:
 *       200: { description: "Bang gia theo zone va loai dich vu. Header X-Cache: HIT | MISS" }
 */
export function buildPublicRouter({ publicCatalogService }) {
  const controller = new PublicController(publicCatalogService);
  const router = Router();
  router.get("/service-types", asyncHandler(controller.serviceTypes));
  router.get("/service-areas", asyncHandler(controller.serviceAreas));
  router.get("/price-tables", asyncHandler(controller.priceTables));
  return router;
}
