import { crudRouter } from "../../core/crudRouter.js";
import { Route } from "../../models/Route.js";
import { createRouteSchema, updateRouteSchema } from "./routes.schema.js";

/**
 * @openapi
 * /routes:
 *   get:
 *     tags: [Routes]
 *     summary: Danh sach tuyen (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sach tuyen }
 *   post:
 *     tags: [Routes]
 *     summary: Tao tuyen moi
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Tao thanh cong }
 * /routes/{id}:
 *   get:
 *     tags: [Routes]
 *     summary: Chi tiet mot tuyen
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Chi tiet tuyen }
 *   put:
 *     tags: [Routes]
 *     summary: Cap nhat tuyen
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Cap nhat thanh cong }
 *   delete:
 *     tags: [Routes]
 *     summary: Xoa tuyen
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Da xoa }
 */

export const routesRouter = crudRouter({
  model: Route,
  resource: "routes",
  createSchema: createRouteSchema,
  updateSchema: updateRouteSchema,
  searchFields: ["code", "name"],
});
