import bcrypt from "bcrypt";
import { User } from "../../models/User.js";
import { ErrorCodes } from "../../core/errors.js";
import { signTokenPair, verifyRefreshToken, assertRefreshTokenActive } from "../../core/jwt.js";
import { assertNotLocked, recordFailure, resetAttempts } from "../../core/loginThrottle.js";
import { sendMail } from "../../core/mailer.js";
import { CUSTOMER_TYPE } from "../../constants/enums.js";
import { blacklistToken, bumpUserTokenVersion, remainingSeconds } from "../../core/refreshTokenStore.js";

export async function login({ emailOrPhone, password }) {
  await assertNotLocked(emailOrPhone);

  const user = await User.findOne({
    $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
  });

  if (!user) {
    await recordFailure(emailOrPhone);
    throw ErrorCodes.INVALID_CREDENTIALS();
  }
  if (user.status === "LOCKED") throw ErrorCodes.ACCOUNT_LOCKED("Tai khoan da bi quan tri vien khoa");
  if (user.status === "PENDING") throw ErrorCodes.ACCOUNT_NOT_ACTIVE();

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    await recordFailure(emailOrPhone);
    throw ErrorCodes.INVALID_CREDENTIALS();
  }

  await resetAttempts(emailOrPhone);
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
    throw ErrorCodes.VALIDATION_ERROR("Thieu thong tin bat buoc");
  }
  if (!CUSTOMER_TYPE.includes(customerType)) {
    throw ErrorCodes.VALIDATION_ERROR("customerType phai la INDIVIDUAL hoac BUSINESS");
  }
  if (customerType === "BUSINESS" && (!shopName || !taxCode)) {
    throw ErrorCodes.VALIDATION_ERROR("Tai khoan doanh nghiep phai co shopName va taxCode");
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
      subject: "EDMS - Da nhan yeu cau dang ky tai khoan doanh nghiep",
      html: `<p>Xin chao ${fullName},</p><p>Yeu cau dang ky tai khoan doanh nghiep <b>${shopName}</b> cua ban dang cho quan tri vien duyet. Chung toi se bao qua email nay khi tai khoan duoc kich hoat.</p>`,
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
  if (!refreshToken) throw ErrorCodes.VALIDATION_ERROR("Thieu refreshToken");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ErrorCodes.UNAUTHORIZED("Refresh token khong hop le hoac da het han");
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
  const user = await User.findById(userId).select("-passwordHash");
  if (!user) throw ErrorCodes.NOT_FOUND("Khong tim thay nguoi dung");
  return user;
}
