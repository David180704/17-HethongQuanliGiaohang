import { ErrorCodes } from "../../core/errors.js";

// Khoa dang nhap 15 phut sau 5 lan sai lien tiep (US-06), dem tren Redis.
// Dem theo dinh danh go vao (email/SDT), ke ca khi tai khoan khong ton tai, de
// khong lo thong tin "tai khoan nay co ton tai hay khong".
export class LoginThrottle {
  /** @param {import("ioredis").Redis} redis */
  constructor(redis, { maxAttempts = 5, lockSeconds = 15 * 60 } = {}) {
    this.redis = redis;
    this.maxAttempts = maxAttempts;
    this.lockSeconds = lockSeconds;
  }

  #keys(identifier) {
    const id = String(identifier).toLowerCase();
    return { fail: `login:fail:${id}`, lock: `login:lock:${id}` };
  }

  // Kiem tra truoc khi cham DB/bcrypt de tra loi nhanh khi dang bi khoa.
  async assertNotLocked(identifier) {
    if (await this.redis.get(this.#keys(identifier).lock)) throw ErrorCodes.ACCOUNT_LOCKED();
  }

  async recordFailure(identifier) {
    const { fail, lock } = this.#keys(identifier);
    const count = await this.redis.incr(fail);
    if (count === 1) await this.redis.expire(fail, this.lockSeconds);
    if (count >= this.maxAttempts) {
      await this.redis.set(lock, "1", "EX", this.lockSeconds);
      await this.redis.del(fail);
      throw ErrorCodes.ACCOUNT_LOCKED();
    }
  }

  async reset(identifier) {
    const { fail, lock } = this.#keys(identifier);
    await this.redis.del(fail, lock);
  }
}
