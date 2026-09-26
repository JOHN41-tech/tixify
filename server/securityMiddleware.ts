import type { NextFunction, Request, Response } from "express";
import { getDb } from "./db";
import { enforceRateLimit, recordSecurityEvent } from "./services/securityService";
import { enforceRedisRateLimit } from "./services/redisSecurityAdapter";

const policies = {
  strict: { limit: 30, windowSeconds: 60 },
  controlled: { limit: 60, windowSeconds: 60 },
  read: { limit: 240, windowSeconds: 60 },
} as const;

function policyFor(path: string) {
  if (/reservations\.create|bookings\.create|payments\.(create|verify)|publicTickets\.(verify|scan)/.test(path)) return "strict" as const;
  if (/events\.(list|get|seats)|queue\./.test(path)) return "read" as const;
  return "controlled" as const;
}

export async function securityRateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "OPTIONS") return next();
  const path = req.originalUrl.split("?")[0] || req.path;
  const policyName = policyFor(path);
  const policy = policies[policyName];
  const identity = req.ip || req.headers["x-forwarded-for"]?.toString().split(",")[0] || "unknown";
  const redisDecision = await enforceRedisRateLimit({ key: `${identity}:${path}`, policy: policyName, limit: policy.limit, windowSeconds: policy.windowSeconds });
  const db = await getDb();
  if (!db && !redisDecision) {
    if (policyName === "strict") return res.status(503).json({ success: false, error: { code: "SECURITY_UNAVAILABLE", message: "Security controls are temporarily unavailable." } });
    return next();
  }
  try {
    const decision = redisDecision ?? await enforceRateLimit(db!, { key: `${identity}:${path}`, policy: policyName, limit: policy.limit, windowSeconds: policy.windowSeconds, ip: identity, endpoint: path });
    res.setHeader("X-RateLimit-Remaining", String(decision.remaining));
    if (!decision.allowed) {
      if (redisDecision && db) await recordSecurityEvent(db, { eventType: "RATE_LIMIT_TRIGGERED", ip: identity, endpoint: path, severity: "MEDIUM", metadata: { policy: policyName, limit: policy.limit } });
      res.setHeader("Retry-After", String(decision.retryAfterSeconds));
      return res.status(429).json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again." } });
    }
    return next();
  } catch {
    if (policyName === "strict") return res.status(503).json({ success: false, error: { code: "SECURITY_UNAVAILABLE", message: "Security controls are temporarily unavailable." } });
    return next();
  }
}
