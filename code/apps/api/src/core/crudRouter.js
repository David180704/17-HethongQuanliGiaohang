import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ok, created } from "./response.js";
import { ErrorCodes } from "./errors.js";

const RESERVED_QUERY_KEYS = new Set(["page", "limit", "search"]);

/**
 * Factory CRUD dung chung cho cac danh muc quan tri (chi ADMIN). Moi resource
 * tu khai bao createSchema/updateSchema (ham validate+sanitize rieng) va
 * searchFields (cac field duoc tim theo tu khoa qua ?search=).
 *
 * beforeDelete(item) co the throw de chan xoa (vd: dang con du lieu phu thuoc).
 */
export function crudRouter({
  model,
  resource,
  createSchema,
  updateSchema,
  searchFields = [],
  beforeDelete,
  allowDelete = true,
  select,
}) {
  const router = Router();
  const permission = `${resource}:manage`;

  router.use(requireAuth, requirePermission(permission));

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

      const filter = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (RESERVED_QUERY_KEYS.has(key)) continue;
        filter[key] = value;
      }
      if (req.query.search && searchFields.length) {
        filter.$or = searchFields.map((field) => ({ [field]: { $regex: req.query.search, $options: "i" } }));
      }

      const [items, total] = await Promise.all([
        model
          .find(filter)
          .select(select)
          .skip((page - 1) * limit)
          .limit(limit)
          .sort({ createdAt: -1 }),
        model.countDocuments(filter),
      ]);

      return ok(res, items, { page, limit, total });
    }),
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const item = await model.findById(req.params.id).select(select);
      if (!item) throw ErrorCodes.NOT_FOUND();
      return ok(res, item);
    }),
  );

  router.post(
    "/",
    validateBody(createSchema),
    asyncHandler(async (req, res) => {
      const createdItem = await model.create(req.body);
      // model.create() tra ve document day du, khong the .select() truc tiep
      // nhu query - doc lai de loai cac field nhay cam (vd passwordHash).
      const item = select ? await model.findById(createdItem._id).select(select) : createdItem;
      return created(res, item);
    }),
  );

  router.put(
    "/:id",
    validateBody(updateSchema),
    asyncHandler(async (req, res) => {
      const item = await model
        .findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        .select(select);
      if (!item) throw ErrorCodes.NOT_FOUND();
      return ok(res, item);
    }),
  );

  if (!allowDelete) return router;

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const item = await model.findById(req.params.id);
      if (!item) throw ErrorCodes.NOT_FOUND();
      if (beforeDelete) await beforeDelete(item);
      await item.deleteOne();
      return ok(res, { deleted: true });
    }),
  );

  return router;
}
