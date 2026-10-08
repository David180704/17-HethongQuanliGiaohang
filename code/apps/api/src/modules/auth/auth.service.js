import bcrypt from "bcrypt";
import { User } from "../../models/User.js";
import { ErrorCodes } from "../../core/errors.js";
import { signTokenPair } from "../../core/jwt.js";

// Dem so lan sai va khoa 15 phut sau 5 lan (tren Redis) la viec cua Sprint 2 (US-06).
// Sprint 1 chi dung toi thieu de demo phat token, chua co co che khoa tam thoi nay.
export async function login({ emailOrPhone, password }) {
  const user = await User.findOne({
    $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }],
  });

  if (!user) throw ErrorCodes.INVALID_CREDENTIALS();
  if (user.status === "LOCKED") throw ErrorCodes.ACCOUNT_LOCKED();
  if (user.status === "PENDING") throw ErrorCodes.ACCOUNT_NOT_ACTIVE();

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) throw ErrorCodes.INVALID_CREDENTIALS();

  const tokens = signTokenPair(user);
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

export async function getProfile(userId) {
  const user = await User.findById(userId).select("-passwordHash");
  if (!user) throw ErrorCodes.NOT_FOUND("Khong tim thay nguoi dung");
  return user;
}
