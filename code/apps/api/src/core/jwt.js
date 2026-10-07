import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(user) {
  const payload = { sub: String(user._id), role: user.role };
  if (user.role === "HUB_STAFF" && user.hubId) payload.hubId = String(user.hubId);
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: String(user._id) }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

export function signTokenPair(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}
