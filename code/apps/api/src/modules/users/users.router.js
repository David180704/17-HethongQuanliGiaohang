import { crudRouter } from "../../core/crudRouter.js";
import { User } from "../../models/User.js";
import { createUserSchema, updateUserSchema } from "./users.schema.js";

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Danh sach nguoi dung (ADMIN), ho tro ?page&limit&search&role...
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach nguoi dung }
 *   post:
 *     tags: [Users]
 *     summary: Tao tai khoan (CUSTOMER/SHIPPER/HUB_STAFF/ADMIN)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tao thanh cong }
 *       409: { description: Email/phone da ton tai }
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Chi tiet mot nguoi dung
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet nguoi dung }
 *       404: { description: Khong tim thay }
 *   put:
 *     tags: [Users]
 *     summary: Doi vai tro, khoa/mo tai khoan, sua ho so
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *       404: { description: Khong tim thay }
 */

// Chi ADMIN quan ly: tao tai khoan nhan vien (SHIPPER/HUB_STAFF/ADMIN khong tu
// dang ky duoc o dau khac), doi vai tro, khoa/mo tai khoan. Khong cho DELETE
// vi se mo cot du lieu dang tham chieu (orders.customerId, assignments.shipperId...).
export const usersRouter = crudRouter({
  model: User,
  resource: "users",
  createSchema: createUserSchema,
  updateSchema: updateUserSchema,
  searchFields: ["email", "phone", "fullName"],
  allowDelete: false,
  select: "-passwordHash",
});
