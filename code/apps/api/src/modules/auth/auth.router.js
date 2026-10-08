import { Router } from "express";
import { asyncHandler, ok, created } from "../../core/response.js";
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
 *       423:
 *         description: Tai khoan dang bi khoa (5 lan sai lien tiep, khoa 15 phut)
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
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Dang ky tai khoan khach hang (ca nhan hoac doanh nghiep)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, phone, password, fullName, customerType]
 *             properties:
 *               email: { type: string }
 *               phone: { type: string }
 *               password: { type: string }
 *               fullName: { type: string }
 *               customerType: { type: string, enum: [INDIVIDUAL, BUSINESS] }
 *               shopName: { type: string }
 *               taxCode: { type: string }
 *     responses:
 *       201:
 *         description: Dang ky thanh cong. Ca nhan ACTIVE ngay, doanh nghiep PENDING cho duyet
 *       400:
 *         description: Thieu du lieu hoac customerType khong hop le
 *       403:
 *         description: Da dang nhap roi (guard nguoc)
 *       409:
 *         description: Email hoac so dien thoai da duoc su dung
 */
authRouter.post(
  "/register",
  guardAuthenticated,
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body || {});
    return created(res, result);
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

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Cap Access Token moi tu Refresh Token (xoay token, vo hieu token cu)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Tra ve cap Access/Refresh Token moi
 *       401:
 *         description: Refresh token khong hop le, het han hoac da bi thu hoi
 */
authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body || {});
    return ok(res, result);
  }),
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Dang xuat, thu hoi Refresh Token hien tai qua Redis blacklist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Da dang xuat
 */
authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await authService.logout(req.body || {});
    return ok(res, { loggedOut: true });
  }),
);

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Dang xuat tren toan bo thiet bi/phien (vo hieu moi Refresh Token da phat)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Da dang xuat toan bo
 *       401:
 *         description: Chua dang nhap
 */
authRouter.post(
  "/logout-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logoutAll(req.user.id);
    return ok(res, { loggedOut: true });
  }),
);
