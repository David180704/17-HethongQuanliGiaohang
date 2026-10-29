import { Router } from "express";
import { asyncHandler } from "./response.js";

/**
 * Factory pattern: dung Express Router chuan cho mot CrudController. Moi danh muc
 * chi can goi ham nay, dung chung chuoi middleware xac thuc -> phan quyen
 * (Chain of Responsibility cua Express).
 *
 * Thay cho crudRouter cu (mot ham lam ca 4 viec: dinh tuyen, kiem tra, truy van,
 * tra response) - nay tach thanh Router / Controller / Service / Repository.
 */
export function createCrudRouter({ controller, permission, requireAuth, requirePermission, allowDelete = true }) {
  const router = Router();
  router.use(requireAuth, requirePermission(permission));

  router.get("/", asyncHandler(controller.list));
  router.get("/:id", asyncHandler(controller.get));
  router.post("/", asyncHandler(controller.create));
  router.put("/:id", asyncHandler(controller.update));
  if (allowDelete) router.delete("/:id", asyncHandler(controller.remove));

  return router;
}
