import Redis from "ioredis";
import { env } from "./env.js";

let client;

export function getRedis() {
  if (!client) {
    client = new Redis(env.redisUrl, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return client;
}
