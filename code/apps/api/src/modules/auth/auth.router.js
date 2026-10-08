import { Router } from "express";
import { asyncHandler, ok } from "../../core/response.js";
import { guardAuthenticated, requireAuth } from "../../middleware/auth.js";
import { ErrorCodes } from "../../core/errors.js";
import * as authService from "./auth.service.js";

export const authRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Dang nhap he thong
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailOrPhone, password]
 *             properties:
 *               emailOrPhone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dang nhap thanh cong, tra ve cap Access/Refresh Token
 *       401:
 *         description: Sai thong tin dang nhap
 *       403:
 *         description: Da dang nhap roi, hoac tai khoan chua duoc kich hoat
 */
authRouter.post(
  "/login",
  guardAuthenticated,
  asyncHandler(async (req, res) => {
    const { emailOrPhone, password } = req.body || {};
    if (!emailOrPhone || !password) {
      throw ErrorCodes.VALIDATION_ERROR("Thieu emailOrPhone hoac password");
    }
    const result = await authService.login({ emailOrPhone, password });
    return ok(res, result);
  }),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Thong tin tai khoan dang dang nhap (minh hoa requireAuth)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thong tin ho so cua chinh minh
 *       401:
 *         description: Chua dang nhap hoac token khong hop le
 */
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user.id);
    return ok(res, user);
  }),
);
