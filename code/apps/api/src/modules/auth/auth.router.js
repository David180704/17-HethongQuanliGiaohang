import { Router } from "express";
import { asyncHandler } from "../../core/response.js";
import { AuthController } from "./AuthController.js";

// Ba endpoint dang ky / dang nhap co guard nguoc (guardAuthenticated): nguoi da
// dang nhap goi lai bi tu choi ALREADY_AUTHENTICATED.
export function buildAuthRouter({ authService, middleware }) {
  const { requireAuth, guardAuthenticated } = middleware;
  const controller = new AuthController(authService);
  const router = Router();

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
   *               app:
   *                 type: string
   *                 enum: [CUSTOMER, STAFF]
   *                 description: App goi dang nhap. Bo trong = khong gioi han vai tro
   *     responses:
   *       200:
   *         description: Dang nhap thanh cong, tra ve cap Access/Refresh Token
   *       401:
   *         description: Sai thong tin dang nhap
   *       403:
   *         description: Da dang nhap roi, tai khoan chua kich hoat, hoac sai app (WRONG_APP)
   *       423:
   *         description: Tai khoan dang bi khoa (5 lan sai lien tiep, khoa 15 phut)
   */
  router.post("/login", guardAuthenticated, asyncHandler(controller.login));

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
  router.post("/register", guardAuthenticated, asyncHandler(controller.register));

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
  router.get("/me", requireAuth, asyncHandler(controller.me));

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
  router.post("/refresh", asyncHandler(controller.refresh));

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
  router.post("/logout", asyncHandler(controller.logout));

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
  router.post("/logout-all", requireAuth, asyncHandler(controller.logoutAll));

  return router;
}
