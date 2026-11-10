import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";
import { BANKS } from "./bankAccount.js";

/**
 * @openapi
 * /profile/banks:
 *   get:
 *     tags: [Profile]
 *     summary: "Danh sach ngan hang nhan tien thu ho [{ code, name }] (cong khai)"
 *     responses:
 *       200: { description: OK }
 * /profile/bank-account:
 *   get:
 *     tags: [Profile]
 *     summary: "Tai khoan ngan hang nhan tien thu ho cua khach dang dang nhap (US-42); null neu chua khai bao"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ bankName, bankCode, accountNumber, accountName } | null" }
 *   put:
 *     tags: [Profile]
 *     summary: "Khai bao / doi tai khoan nhan thu ho: ngan hang, so tai khoan (6-19 chu so), chu tai khoan (tu bo dau, in hoa)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankCode, accountNumber, accountName]
 *             properties:
 *               bankCode: { type: string, example: "VCB" }
 *               accountNumber: { type: string, example: "0011004455667" }
 *               accountName: { type: string, example: "Nguyễn Văn An" }
 *     responses:
 *       200: { description: "Tai khoan da luu (ten chu tai khoan: NGUYEN VAN AN)" }
 *       400: { description: Du lieu khong hop le }
 *       403: { description: Khong phai khach hang }
 *   delete:
 *     tags: [Profile]
 *     summary: Xoa tai khoan nhan thu ho
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ deleted: true }" }
 */
export function buildProfileRouter({ profileService, middleware }) {
  const { requireAuth, requirePermission } = middleware;
  const router = Router();
  router.get("/banks", (req, res) => ok(res, BANKS));
  // Quyen profile:update:own (vai tro CUSTOMER); service kiem them vai tro
  router.use(requireAuth, requirePermission("profile:update:own"));
  router.get("/bank-account", asyncHandler(async (req, res) => ok(res, await profileService.bankAccount(req.user))));
  router.put("/bank-account", asyncHandler(async (req, res) => ok(res, await profileService.saveBankAccount(req.user, req.body || {}))));
  router.delete("/bank-account", asyncHandler(async (req, res) => ok(res, await profileService.removeBankAccount(req.user))));
  return router;
}
