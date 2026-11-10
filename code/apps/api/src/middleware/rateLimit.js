import { ErrorCodes } from "../core/errors.js";

/**
 * Middleware gioi han tan suat theo dia chi IP (US-22: tra cuu cong khai 20 lan/phut).
 * Vuot nguong -> 429 TOO_MANY_REQUESTS kem Retry-After; luon tra X-RateLimit-Limit / Remaining.
 * @param {object} options
 * @param {import("../infrastructure/security/RateLimiter.js").RateLimiter} options.limiter
 * @param {string} options.name ten nhom API (vd "tracking")
 */
export function createRateLimit({ limiter, name, limit, windowSeconds }) {
  return async (req, res, next) => {
    try {
      const { count, ttlSeconds } = await limiter.hit(`ratelimit:${name}:${req.ip}`, windowSeconds);
      res.set("X-RateLimit-Limit", String(limit));
      res.set("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
      if (count > limit) {
        res.set("Retry-After", String(ttlSeconds));
        return next(ErrorCodes.TOO_MANY_REQUESTS(`Tra cứu quá ${limit} lần mỗi phút — thử lại sau ${ttlSeconds} giây`));
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}
