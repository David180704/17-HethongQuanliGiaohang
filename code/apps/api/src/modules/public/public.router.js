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
 *     summary: Vung phuc vu (khong can dang nhap), tim theo tinh hoac xa/phuong, cache 30 giay
 *     parameters: [{ in: query, name: search, schema: { type: string } }]
 *     responses:
 *       200: { description: "Danh sach xa/phuong dang phuc vu (province, ward, region). Header X-Cache: HIT | MISS" }
 * /public/provinces:
 *   get:
 *     tags: [Public]
 *     summary: 34 tinh/thanh theo dia gioi tu 01/07/2025 (khong con quan/huyen), kem so xa/phuong dang phuc vu
 *     responses:
 *       200: { description: "[{ name, fullName, wardCount, servedCount }]. Header X-Cache: HIT | MISS" }
 * /public/provinces/wards:
 *   get:
 *     tags: [Public]
 *     summary: Xa/phuong cua mot tinh/thanh (go khong dau duoc) - dia chi go tay phai khop danh sach nay
 *     parameters: [{ in: query, name: province, required: true, schema: { type: string, example: "Hà Nội" } }]
 *     responses:
 *       200: { description: "{ province, wards: [{ name, served }] }" }
 *       400: { description: "Tinh/thanh khong co trong danh muc" }
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
  router.get("/provinces", asyncHandler(controller.provinces));
  router.get("/provinces/wards", asyncHandler(controller.wards));
  router.get("/price-tables", asyncHandler(controller.priceTables));
  return router;
}
