import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { ErrorCodes } from "../../core/errors.js";

// Cap va kiem tra cap token JWT: Access 15 phut, Refresh 7 ngay (cau hinh trong env).
export class JwtTokenService {
  /**
   * @param {object} deps
   * @param {import("./RefreshTokenStore.js").RefreshTokenStore} deps.refreshTokenStore
   */
  constructor({ accessSecret, refreshSecret, accessExpiresIn, refreshExpiresIn, refreshTokenStore }) {
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.accessExpiresIn = accessExpiresIn;
    this.refreshExpiresIn = refreshExpiresIn;
    this.refreshTokenStore = refreshTokenStore;
  }

  signAccessToken(user) {
    const payload = { sub: String(user._id), role: user.role };
    if (user.role === "HUB_STAFF" && user.hubId) payload.hubId = String(user.hubId);
    return jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpiresIn });
  }

  async signRefreshToken(user) {
    const userId = String(user._id);
    const ver = await this.refreshTokenStore.getUserVersion(userId);
    return jwt.sign({ sub: userId, ver, jti: randomUUID() }, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
    });
  }

  async signPair(user) {
    return { accessToken: this.signAccessToken(user), refreshToken: await this.signRefreshToken(user) };
  }

  verifyAccess(token) {
    return jwt.verify(token, this.accessSecret);
  }

  verifyRefresh(token) {
    return jwt.verify(token, this.refreshSecret);
  }

  // Refresh Token con han va dung chu ky chua chac con "song": phai chua bi logout
  // (jti trong blacklist) va chua bi logout-all (ver nho hon version hien tai).
  async assertRefreshActive(payload) {
    const [blacklisted, currentVer] = await Promise.all([
      this.refreshTokenStore.isBlacklisted(payload.jti),
      this.refreshTokenStore.getUserVersion(payload.sub),
    ]);
    if (blacklisted || payload.ver !== currentVer) {
      throw ErrorCodes.UNAUTHORIZED("Refresh token đã bị thu hồi");
    }
  }

  // Thu hoi 1 token: blacklist voi TTL bang han con lai (het han thi Redis tu xoa).
  async revoke(payload) {
    const remaining = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    await this.refreshTokenStore.blacklist(payload.jti, remaining);
  }

  async revokeAll(userId) {
    await this.refreshTokenStore.bumpUserVersion(String(userId));
  }
}
