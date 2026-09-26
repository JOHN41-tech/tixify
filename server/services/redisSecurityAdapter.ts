import Redis from "ioredis";

export type RedisRateLimitDecision = { allowed: boolean; remaining: number; retryAfterSeconds: number };

let client: Redis | null | undefined;

export function getRedisSecurityClient() {
  if (client !== undefined) return client;
  if (!process.env.REDIS_URL) {
    client = null;
    return client;
  }
  client = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: false });
  client.on("error", (error) => console.warn("[Security] Redis error:", error.message));
  return client;
}

export async function enforceRedisRateLimit(input: { key: string; policy: string; limit: number; windowSeconds: number }): Promise<RedisRateLimitDecision | null> {
  const redis = getRedisSecurityClient();
  if (!redis) return null;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / input.windowSeconds);
  const redisKey = `tixify:rate:${input.policy}:${input.key}:${bucket}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, input.windowSeconds + 1);
  return { allowed: count <= input.limit, remaining: Math.max(0, input.limit - count), retryAfterSeconds: input.windowSeconds - (now % input.windowSeconds) };
}

export async function redisQueueSize(eventId: number) {
  const redis = getRedisSecurityClient();
  if (!redis) return null;
  return redis.zcard(`tixify:queue:${eventId}`);
}
