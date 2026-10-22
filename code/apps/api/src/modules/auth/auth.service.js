import bcrypt from "bcrypt";
import { User } from "../../models/User.js";
import { ErrorCodes } from "../../core/errors.js";
import { signTokenPair, verifyRefreshToken, assertRefreshTokenActive } from "../../core/jwt.js";
import { assertNotLocked, recordFailure, resetAttempts } from "../../core/loginThrottle.js";
import { sendMail } from "../../core/mailer.js";
import { APP_ROLES, CUSTOMER_TYPE } from "../../constants/enums.js";
import { blacklistToken, bumpUserTokenVersion, remainingSeconds } from "../../core/refreshTokenStore.js";

const WRONG_APP_MESSAGES = {
  STAFF: "Tài khoản khách hàng không đăng nhập được App Nhân viên. Vui lòng dùng App Khách hàng.",
  CUSTOMER: "Tài khoản nhân viên không dùng App Khách hàng. Vui lòng dùng App Nhân viên.",
};

// app: "CUSTOMER" | "STAFF" | undefined. Bo trong = khong gioi han (Swagger, test, script).
export async function login({ emailOrPhone, password, app }) {
  if (app !== undefined && !Object.hasOwn(APP_ROLES, app)) {
    throw ErrorCodes.VALIDATION_ERROR("app phải là CUSTOMER hoặc STAFF");
  }
  await assertNotLocked(emailOrPhone);

  const user = await User.findOne({
    $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
  });

  if (!user) {
    await recordFailure(emailOrPhone);
    throw ErrorCodes.INVALID_CREDENTIALS();
  }
  if (user.status === "LOCKED") throw ErrorCodes.ACCOUNT_LOCKED("Tài khoản đã bị quản trị viên khóa");
  if (user.status === "PENDING") throw ErrorCodes.ACCOUNT_NOT_ACTIVE();

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    await recordFailure(emailOrPhone);
    throw ErrorCodes.INVALID_CREDENTIALS();
  }

  await resetAttempts(emailOrPhone);

  // Kiem tra SAU khi dung mat khau: neu kiem tra truoc, nguoi la chi can biet
  // email la do duoc vai tro cua tai khoan. Tu choi o day thi khong cap token.
  if (app && !APP_ROLES[app].includes(user.role)) {
    throw ErrorCodes.WRONG_APP(WRONG_APP_MESSAGES[app]);
  }

  const tokens = await signTokenPair(user);
  return {
    ...tokens,
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}

export async function register({ email, phone, password, fullName, customerType, shopName, taxCode }) {
  if (!email || !phone || !password || !fullName || !customerType) {
    throw ErrorCodes.VALIDATION_ERROR("Thiếu thông tin bắt buộc");
  }
  if (!CUSTOMER_TYPE.includes(customerType)) {
    throw ErrorCodes.VALIDATION_ERROR("customerType phải là INDIVIDUAL hoặc BUSINESS");
  }
  if (customerType === "BUSINESS" && (!shopName || !taxCode)) {
    throw ErrorCodes.VALIDATION_ERROR("Tài khoản doanh nghiệp phải có shopName và taxCode");
  }

  const normalizedEmail = email.toLowerCase();
  if (await User.findOne({ email: normalizedEmail })) throw ErrorCodes.EMAIL_ALREADY_EXISTS();
  if (await User.findOne({ phone })) throw ErrorCodes.PHONE_ALREADY_EXISTS();

  const passwordHash = await bcrypt.hash(password, 10);
  const isBusiness = customerType === "BUSINESS";
  const status = isBusiness ? "PENDING" : "ACTIVE";

  const user = await User.create({
    email: normalizedEmail,
    phone,
    passwordHash,
    fullName,
    role: "CUSTOMER",
    status,
    customerType,
    ...(isBusiness ? { shopName, taxCode } : {}),
  });

  if (isBusiness) {
    await sendMail({
      to: user.email,
      subject: "EDMS - Đã nhận yêu cầu đăng ký tài khoản doanh nghiệp",
      html: `<p>Xin chào ${fullName},</p><p>Yêu cầu đăng ký tài khoản doanh nghiệp <b>${shopName}</b> của bạn đang chờ quản trị viên duyệt. Chúng tôi sẽ báo qua email này khi tài khoản được kích hoạt.</p>`,
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

export async function refresh({ refreshToken }) {
  if (!refreshToken) throw ErrorCodes.VALIDATION_ERROR("Thiếu refreshToken");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ErrorCodes.UNAUTHORIZED("Refresh token không hợp lệ hoặc đã hết hạn");
  }

  await assertRefreshTokenActive(payload);

  const user = await User.findById(payload.sub);
  if (!user) throw ErrorCodes.UNAUTHORIZED();

  // Xoay token: vo hieu refresh token cu ngay sau khi dung, tranh bi dung lai.
  await blacklistToken(payload.jti, remainingSeconds(payload.exp));

  return signTokenPair(user);
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return; // token da khong hop le/het han thi coi nhu da dang xuat
  }
  await blacklistToken(payload.jti, remainingSeconds(payload.exp));
}

export async function logoutAll(userId) {
  await bumpUserTokenVersion(String(userId));
}

export async function getProfile(userId) {
  // Kem ten hub/tuyen de App Nhan vien hien thi "Hub phu trach", "Tuyen" ma khong goi them API.
  const user = await User.findById(userId)
    .select("-passwordHash")
    .populate("hubId", "code name")
    .populate("routeIds", "code name");
  if (!user) throw ErrorCodes.NOT_FOUND("Không tìm thấy người dùng");
  return user;
}
