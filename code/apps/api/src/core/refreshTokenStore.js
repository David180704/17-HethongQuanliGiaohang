import { getRedis } from "../config/redis.js";

// Logout (1 phien): blacklist dung mot Refresh Token theo jti, TTL = han con lai.
// Logout-all (toan bo phien): tang "version" cua user, moi Refresh Token cu
// nhung con "version" thap hon deu vo hieu ngay ma khong can liet ke tung token.

function verKey(userId) {
  return `refresh:ver:${userId}`;
}

function blacklistKey(jti) {
  return `refresh:blacklist:${jti}`;
}

export async function getUserTokenVersion(userId) {
  const v = await getRedis().get(verKey(userId));
  return v ? Number(v) : 0;
}

export async function bumpUserTokenVersion(userId) {
  await getRedis().incr(verKey(userId));
}

export function remainingSeconds(expUnixSeconds) {
  return Math.max(0, expUnixSeconds - Math.floor(Date.now() / 1000));
}

export async function blacklistToken(jti, ttlSeconds) {
  if (ttlSeconds > 0) await getRedis().set(blacklistKey(jti), "1", "EX", ttlSeconds);
}

export async function isBlacklisted(jti) {
  return Boolean(await getRedis().get(blacklistKey(jti)));
}
