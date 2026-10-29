import { ErrorCodes } from "../../core/errors.js";
import { APP_ROLES, CUSTOMER_TYPE } from "../../constants/enums.js";
import { escapeHtml } from "../../infrastructure/mail/MailService.js";

const WRONG_APP_MESSAGES = {
  STAFF: "Tài khoản khách hàng không đăng nhập được App Nhân viên. Vui lòng dùng App Khách hàng.",
  CUSTOMER: "Tài khoản nhân viên không dùng App Khách hàng. Vui lòng dùng App Nhân viên.",
};

// Chi nhan chuoi: chan object kieu {"$ne": null} (NoSQL injection) va loi 500.
const isFilled = (value) => typeof value === "string" && value !== "";

/**
 * Xac thuc: dang nhap (US-06), dang ky (US-07), dang xuat / lam moi token (US-08).
 * Moi phu thuoc duoc tiem qua constructor (Dependency Inversion): service khong
 * biet Redis, bcrypt, JWT hay nodemailer - chi biet cac giao dien nho cua chung.
 */
export class AuthService {
  /**
   * @param {object} deps
   * @param {import("../users/UserRepository.js").UserRepository} deps.userRepository  KHONG cache: dang nhap phai thay trang thai moi nhat (vd vua bi khoa)
   * @param {{ hash(p): Promise<string>, compare(p, h): Promise<boolean> }} deps.passwordHasher
   * @param {import("../../infrastructure/security/JwtTokenService.js").JwtTokenService} deps.tokenService
   * @param {import("../../infrastructure/security/LoginThrottle.js").LoginThrottle} deps.loginThrottle
   * @param {{ send(mail): Promise<unknown> }} deps.mailService
   */
  constructor({ userRepository, passwordHasher, tokenService, loginThrottle, mailService }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
    this.loginThrottle = loginThrottle;
    this.mailService = mailService;
  }

  // app: "CUSTOMER" | "STAFF" | undefined. Bo trong = khong gioi han (Swagger, test, script).
  async login({ emailOrPhone, password, app } = {}) {
    if (!isFilled(emailOrPhone) || !isFilled(password)) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu emailOrPhone hoặc password");
    }
    if (app !== undefined && !Object.hasOwn(APP_ROLES, app)) {
      throw ErrorCodes.VALIDATION_ERROR("app phải là CUSTOMER hoặc STAFF");
    }
    await this.loginThrottle.assertNotLocked(emailOrPhone);

    const user = await this.userRepository.findForLogin(emailOrPhone);
    if (!user) {
      await this.loginThrottle.recordFailure(emailOrPhone);
      throw ErrorCodes.INVALID_CREDENTIALS();
    }
    if (user.status === "LOCKED") throw ErrorCodes.ACCOUNT_LOCKED("Tài khoản đã bị quản trị viên khóa");
    if (user.status === "PENDING") throw ErrorCodes.ACCOUNT_NOT_ACTIVE();

    if (!(await this.passwordHasher.compare(password, user.passwordHash))) {
      await this.loginThrottle.recordFailure(emailOrPhone);
      throw ErrorCodes.INVALID_CREDENTIALS();
    }
    await this.loginThrottle.reset(emailOrPhone);

    // Kiem tra SAU khi dung mat khau: neu kiem tra truoc, nguoi la chi can biet
    // email la do duoc vai tro cua tai khoan. Tu choi o day thi khong cap token.
    if (app && !APP_ROLES[app].includes(user.role)) {
      throw ErrorCodes.WRONG_APP(WRONG_APP_MESSAGES[app]);
    }

    const tokens = await this.tokenService.signPair(user);
    return {
      ...tokens,
      user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role },
    };
  }

  async register({ email, phone, password, fullName, customerType, shopName, taxCode } = {}) {
    if (![email, phone, password, fullName, customerType].every(isFilled)) {
      throw ErrorCodes.VALIDATION_ERROR("Thiếu thông tin bắt buộc");
    }
    if (!CUSTOMER_TYPE.includes(customerType)) {
      throw ErrorCodes.VALIDATION_ERROR("customerType phải là INDIVIDUAL hoặc BUSINESS");
    }
    const isBusiness = customerType === "BUSINESS";
    if (isBusiness && (!isFilled(shopName) || !isFilled(taxCode))) {
      throw ErrorCodes.VALIDATION_ERROR("Tài khoản doanh nghiệp phải có shopName và taxCode");
    }

    if (await this.userRepository.existsByEmail(email)) throw ErrorCodes.EMAIL_ALREADY_EXISTS();
    if (await this.userRepository.existsByPhone(phone)) throw ErrorCodes.PHONE_ALREADY_EXISTS();

    const user = await this.userRepository.create({
      email: email.toLowerCase(),
      phone,
      passwordHash: await this.passwordHasher.hash(password),
      fullName,
      role: "CUSTOMER",
      // Ca nhan dung duoc ngay; doanh nghiep cho quan tri vien duyet
      status: isBusiness ? "PENDING" : "ACTIVE",
      customerType,
      ...(isBusiness ? { shopName, taxCode } : {}),
    });

    if (isBusiness) {
      await this.mailService.send({
        to: user.email,
        subject: "EDMS - Đã nhận yêu cầu đăng ký tài khoản doanh nghiệp",
        html: `<p>Xin chào ${escapeHtml(fullName)},</p><p>Yêu cầu đăng ký tài khoản doanh nghiệp <b>${escapeHtml(shopName)}</b> của bạn đang chờ quản trị viên duyệt. Chúng tôi sẽ báo qua email này khi tài khoản được kích hoạt.</p>`,
      });
    }

    return {
      id: user._id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      customerType: user.customerType,
    };
  }

  async refresh({ refreshToken } = {}) {
    if (!isFilled(refreshToken)) throw ErrorCodes.VALIDATION_ERROR("Thiếu refreshToken");

    let payload;
    try {
      payload = this.tokenService.verifyRefresh(refreshToken);
    } catch {
      throw ErrorCodes.UNAUTHORIZED("Refresh token không hợp lệ hoặc đã hết hạn");
    }
    await this.tokenService.assertRefreshActive(payload);

    const user = await this.userRepository.findById(payload.sub);
    if (!user) throw ErrorCodes.UNAUTHORIZED();

    // Xoay token: vo hieu refresh token cu ngay sau khi dung, tranh bi dung lai.
    await this.tokenService.revoke(payload);
    return this.tokenService.signPair(user);
  }

  async logout({ refreshToken } = {}) {
    if (!isFilled(refreshToken)) return;
    let payload;
    try {
      payload = this.tokenService.verifyRefresh(refreshToken);
    } catch {
      return; // token da khong hop le/het han thi coi nhu da dang xuat
    }
    await this.tokenService.revoke(payload);
  }

  logoutAll(userId) {
    return this.tokenService.revokeAll(userId);
  }

  async getProfile(userId) {
    const user = await this.userRepository.findProfile(userId);
    if (!user) throw ErrorCodes.NOT_FOUND("Không tìm thấy người dùng");
    return user;
  }
}
