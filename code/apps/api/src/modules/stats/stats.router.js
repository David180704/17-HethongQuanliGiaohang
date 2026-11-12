import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";

/**
 * @openapi
 * /stats/overview:
 *   get:
 *     tags: [Stats]
 *     summary: "Thong ke van hanh (US-39) bang aggregation pipeline: don tao/lay/dang van chuyen/cho giao/giao thanh cong/that bai/hoan; theo shop, khu vuc, kho; nang suat nguoi giao hang; doanh thu phi; thu ho; doi soat"
 *     description: "Quan tri vien: toan he thong (kem doi soat); nhan vien kho: don thuoc kho minh va buu cuc truc thuoc. Mac dinh tu dau thang toi hom nay."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, schema: { type: string, example: "2026-11-01" } }
 *       - { in: query, name: to, schema: { type: string, example: "2026-11-30" } }
 *     responses:
 *       200: { description: "{ orders: { created, pickedUp, inTransit, waitingDelivery, delivered, deliveryFailed, returned }, byStatus, byShop, byArea, byHub, shippers, revenue, cod, settlements }" }
 *       403: { description: "Khach hang, nguoi giao hang" }
 */
export function buildStatsRouter({ statsService, middleware }) {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get("/overview", asyncHandler(async (req, res) => ok(res, await statsService.overview(req.user, req.query))));
  return router;
}
