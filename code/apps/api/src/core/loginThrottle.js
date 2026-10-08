import { getRedis } from "../config/redis.js";
import { ErrorCodes } from "./errors.js";

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;

function keys(identifier) {
  const id = identifier.toLowerCase();
  return {
    fail: `login:fail:${id}`,
    lock: `login:lock:${id}`,
  };
}

// Kiem tra truoc khi cham DB/bcrypt de tra loi nhanh khi dang bi khoa.
export async function assertNotLocked(identifier) {
  const { lock } = keys(identifier);
  const locked = await getRedis().get(lock);
  if (locked) throw ErrorCodes.ACCOUNT_LOCKED();
}

// Goi khi sai mat khau hoac khong tim thay tai khoan. Dem chung tren cung
// mot dinh danh de khong lo thong tin tai khoan co ton tai hay khong.
export async function recordFailure(identifier) {
  const redis = getRedis();
  const { fail, lock } = keys(identifier);

  const count = await redis.incr(fail);
  if (count === 1) await redis.expire(fail, LOCK_SECONDS);

  if (count >= MAX_ATTEMPTS) {
    await redis.set(lock, "1", "EX", LOCK_SECONDS);
    await redis.del(fail);
    throw ErrorCodes.ACCOUNT_LOCKED();
  }
}

export async function resetAttempts(identifier) {
  const { fail, lock } = keys(identifier);
  await getRedis().del(fail, lock);
}
