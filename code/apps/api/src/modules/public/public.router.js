import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";
import * as publicService from "./public.service.js";

export const publicRouter = Router();

/**
 * @openapi
 * /public/service-types:
 *   get:
 *     tags: [Public]
 *     summary: Loai dich vu dang hoat dong (khong can dang nhap)
 *     responses:
 *       200: { description: Danh sach loai dich vu }
 * /public/service-areas:
 *   get:
 *     tags: [Public]
 *     summary: Vung phuc vu (khong can dang nhap), tim theo tinh/quan
 *     parameters: [{ in: query, name: search, schema: { type: string } }]
 *     responses:
 *       200: { description: Danh sach quan/huyen dang phuc vu }
 * /public/price-tables:
 *   get:
 *     tags: [Public]
 *     summary: Bang gia dang hieu luc (khong can dang nhap)
 *     responses:
 *       200: { description: Bang gia theo zone va loai dich vu }
 */

publicRouter.get(
  "/service-types",
  asyncHandler(async (req, res) => ok(res, await publicService.listServiceTypes())),
);

publicRouter.get(
  "/service-areas",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    return ok(res, await publicService.listServiceAreas({ search }));
  }),
);

publicRouter.get(
  "/price-tables",
  asyncHandler(async (req, res) => ok(res, await publicService.listActivePriceTables())),
);
