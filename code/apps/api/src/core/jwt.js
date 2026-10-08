import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { getUserTokenVersion, isBlacklisted } from "./refreshTokenStore.js";
import { ErrorCodes } from "./errors.js";

export function signAccessToken(user) {
  const payload = { sub: String(user._id), role: user.role };
  if (user.role === "HUB_STAFF" && user.hubId) payload.hubId = String(user.hubId);
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });
}

export async function signRefreshToken(user) {
  const userId = String(user._id);
  const ver = await getUserTokenVersion(userId);
  const jti = randomUUID();
  return jwt.sign({ sub: userId, ver, jti }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

export async function signTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = await signRefreshToken(user);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

// Refresh Token con hop le ve mat ky thuat (chua het han, dung secret) khong
// co nghia la con "song": phai chua bi logout (jti nam trong blacklist) va
// chua bi logout-all (ver nho hon version hien tai cua user).
export async function assertRefreshTokenActive(payload) {
  const [blacklisted, currentVer] = await Promise.all([
    isBlacklisted(payload.jti),
    getUserTokenVersion(payload.sub),
  ]);
  if (blacklisted || payload.ver !== currentVer) {
    throw ErrorCodes.UNAUTHORIZED("Refresh token da bi thu hoi");
  }
}
