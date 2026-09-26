import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import {
  auditLogs,
  events,
  queueEntries,
  securityEvents,
  securityRateLimits,
  ticketScans,
  tickets,
} from "../../drizzle/schema";
import type { Database } from "../db";

export type SignedTicketPayload = {
  v: 1;
  ticketId: string;
  eventId: string;
  seatId: string;
  userId: string;
  issuedAt: string;
  expiresAt: string | null;
  version: number;
};

export type TicketVerificationResult =
  | { status: "VALID"; ticketId: number; eventId: number; seatId: number }
  | { status: "ALREADY_USED" | "EXPIRED" | "INVALID_SIGNATURE" | "TICKET_NOT_FOUND" | "CANCELLED" | "WRONG_EVENT" };

export type BotDecision = "NORMAL" | "INCREASED_RATE_LIMIT" | "CHALLENGE" | "TEMPORARY_RESTRICTION";

export function evaluateBotSignals(input: { requestsInWindow: number; duplicateRequests: number; failedBookings: number; rapidSeatChanges: number }): BotDecision {
  const score = input.requestsInWindow + input.duplicateRequests * 3 + input.failedBookings * 2 + input.rapidSeatChanges * 2;
  if (score >= 80 || input.requestsInWindow >= 240) return "TEMPORARY_RESTRICTION";
  if (score >= 35 || input.requestsInWindow >= 120) return "CHALLENGE";
  if (score >= 12 || input.requestsInWindow >= 60) return "INCREASED_RATE_LIMIT";
  return "NORMAL";
}

let ephemeralKeyPair: { privateKey: string; publicKey: string } | undefined;

function keyPair() {
  const privateKey = process.env.TICKET_SIGNING_PRIVATE_KEY;
  const publicKey = process.env.TICKET_SIGNING_PUBLIC_KEY;
  if (privateKey && publicKey) return { privateKey, publicKey };
  if (!ephemeralKeyPair) {
    const generated = generateKeyPairSync("ed25519", { privateKeyEncoding: { format: "pem", type: "pkcs8" }, publicKeyEncoding: { format: "pem", type: "spki" } });
    ephemeralKeyPair = { privateKey: generated.privateKey, publicKey: generated.publicKey };
    if (process.env.NODE_ENV === "production") console.warn("[Security] Ticket signing keys are not configured; configure TICKET_SIGNING_PRIVATE_KEY and TICKET_SIGNING_PUBLIC_KEY.");
  }
  return ephemeralKeyPair;
}

function canonical(payload: SignedTicketPayload) {
  return JSON.stringify(payload);
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function createSignedTicket(input: Omit<SignedTicketPayload, "v" | "version"> & { version?: number }) {
  const payload: SignedTicketPayload = { v: 1, version: input.version ?? 1, ...input };
  const signature = sign(null, Buffer.from(canonical(payload)), keyPair().privateKey);
  return { payload, payloadToken: encode(canonical(payload)), signature: encode(signature), qrValue: `tix1.${encode(canonical(payload))}.${encode(signature)}` };
}

export function parseTicketQr(value: string) {
  const [prefix, payloadToken, signature] = value.trim().split(".");
  if (prefix !== "tix1" || !payloadToken || !signature) return null;
  try {
    const payload = JSON.parse(decode(payloadToken).toString()) as SignedTicketPayload;
    if (payload.v !== 1 || !payload.ticketId || !payload.eventId || !payload.seatId || !payload.userId || !payload.issuedAt || typeof payload.version !== "number") return null;
    return { payload, payloadToken, signature };
  } catch { return null; }
}

export function verifyTicketQr(value: string) {
  const parsed = parseTicketQr(value);
  if (!parsed) return { valid: false as const, reason: "MALFORMED" as const };
  const valid = verify(null, Buffer.from(canonical(parsed.payload)), keyPair().publicKey, decode(parsed.signature));
  return valid ? { valid: true as const, ...parsed } : { valid: false as const, reason: "INVALID_SIGNATURE" as const };
}

export async function verifyTicket(db: Database, input: { qrValue: string; expectedEventId?: number; ip?: string }): Promise<TicketVerificationResult> {
  const cryptographic = verifyTicketQr(input.qrValue);
  if (!cryptographic.valid) {
    await recordSecurityEvent(db, { eventType: "INVALID_SIGNATURE", ip: input.ip, endpoint: "/api/tickets/verify", severity: "HIGH" });
    return { status: "INVALID_SIGNATURE" };
  }
  const { payload } = cryptographic;
  const rows = await db.select().from(tickets).where(eq(tickets.publicCode, payload.ticketId)).limit(1);
  const ticket = rows[0];
  if (!ticket || String(ticket.eventId) !== payload.eventId || String(ticket.userId) !== payload.userId) return { status: "TICKET_NOT_FOUND" };
  if (input.expectedEventId && ticket.eventId !== input.expectedEventId) return { status: "WRONG_EVENT" };
  if (ticket.signature !== cryptographic.signature || ticket.signedPayload !== cryptographic.payloadToken) return { status: "INVALID_SIGNATURE" };
  if (ticket.status === "CANCELLED") return { status: "CANCELLED" };
  if (ticket.status === "USED") return { status: "ALREADY_USED" };
  if (ticket.expiresAt && ticket.expiresAt <= new Date()) return { status: "EXPIRED" };
  await recordAudit(db, { actorType: "SCANNER", action: "TICKET_VERIFIED", entityType: "TICKET", entityId: String(ticket.id), metadata: { eventId: ticket.eventId } });
  return { status: "VALID", ticketId: ticket.id, eventId: ticket.eventId, seatId: Number(payload.seatId) };
}

export function hashIp(ip: string | undefined) {
  return createHash("sha256").update(ip || "unknown").digest("hex");
}

export async function recordSecurityEvent(db: Database, input: { eventType: string; userId?: number; ip?: string; endpoint?: string; severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; metadata?: Record<string, unknown> }) {
  await db.insert(securityEvents).values({ eventType: input.eventType, userId: input.userId ?? null, ipHash: hashIp(input.ip), endpoint: input.endpoint ?? null, severity: input.severity ?? "MEDIUM", metadataJson: input.metadata ? JSON.stringify(input.metadata) : null });
}

export async function recordAudit(db: Database, input: { actorType: string; actorId?: string; action: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }) {
  await db.insert(auditLogs).values({ actorType: input.actorType, actorId: input.actorId ?? null, action: input.action, entityType: input.entityType ?? null, entityId: input.entityId ?? null, metadataJson: input.metadata ? JSON.stringify(input.metadata) : null });
}

export async function verifyAndScanTicket(db: Database, input: { qrValue: string; expectedEventId?: number; scannerId?: string; ip?: string }): Promise<TicketVerificationResult> {
  const cryptographic = verifyTicketQr(input.qrValue);
  if (!cryptographic.valid) {
    await recordSecurityEvent(db, { eventType: "INVALID_SIGNATURE", ip: input.ip, endpoint: "/api/tickets/scan", severity: "HIGH" });
    return { status: "INVALID_SIGNATURE" };
  }
  const { payload } = cryptographic;
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tickets).where(eq(tickets.publicCode, payload.ticketId)).for("update");
    const ticket = rows[0];
    if (!ticket || String(ticket.eventId) !== payload.eventId || String(ticket.userId) !== payload.userId) return { status: "TICKET_NOT_FOUND" as const };
    if (input.expectedEventId && ticket.eventId !== input.expectedEventId) return { status: "WRONG_EVENT" as const };
    if (ticket.status === "CANCELLED") return { status: "CANCELLED" as const };
    if (ticket.status === "USED") {
      await tx.insert(ticketScans).values({ ticketId: ticket.id, scannerId: input.scannerId ?? null, result: "ALREADY_USED", ipHash: hashIp(input.ip) });
      await tx.insert(securityEvents).values({ eventType: "REPLAY_ATTEMPT", ipHash: hashIp(input.ip), endpoint: "/api/tickets/scan", severity: "HIGH", metadataJson: JSON.stringify({ ticketId: ticket.id }) });
      await tx.insert(auditLogs).values({ actorType: "SCANNER", actorId: input.scannerId ?? null, action: "TICKET_SCAN_REJECTED", entityType: "TICKET", entityId: String(ticket.id), metadataJson: JSON.stringify({ result: "ALREADY_USED" }) });
      return { status: "ALREADY_USED" as const };
    }
    if (ticket.signature !== cryptographic.signature || ticket.signedPayload !== cryptographic.payloadToken) return { status: "INVALID_SIGNATURE" as const };
    if (ticket.expiresAt && ticket.expiresAt <= new Date()) return { status: "EXPIRED" as const };
    await tx.update(tickets).set({ status: "USED", usedAt: new Date(), usedBy: input.scannerId ?? null }).where(and(eq(tickets.id, ticket.id), eq(tickets.status, "VALID")));
    await tx.insert(ticketScans).values({ ticketId: ticket.id, scannerId: input.scannerId ?? null, result: "VALID", ipHash: hashIp(input.ip) });
    await tx.insert(auditLogs).values({ actorType: "SCANNER", actorId: input.scannerId ?? null, action: "TICKET_SCAN_SUCCESS", entityType: "TICKET", entityId: String(ticket.id) });
    return { status: "VALID" as const, ticketId: ticket.id, eventId: ticket.eventId, seatId: Number(payload.seatId) };
  });
}

export async function enforceRateLimit(db: Database, input: { key: string; policy: string; limit: number; windowSeconds: number; userId?: number; ip?: string; endpoint?: string }) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (input.windowSeconds * 1000)) * input.windowSeconds * 1000);
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(securityRateLimits).where(and(eq(securityRateLimits.key, input.key), eq(securityRateLimits.policy, input.policy), eq(securityRateLimits.windowStart, windowStart))).for("update");
    const current = rows[0]?.count ?? 0;
    if (rows[0]) await tx.update(securityRateLimits).set({ count: current + 1, updatedAt: now }).where(eq(securityRateLimits.id, rows[0].id));
    else await tx.insert(securityRateLimits).values({ key: input.key, policy: input.policy, windowStart, count: 1 });
    const allowed = current < input.limit;
    if (!allowed) await tx.insert(securityEvents).values({ eventType: "RATE_LIMIT_TRIGGERED", userId: input.userId ?? null, ipHash: hashIp(input.ip), endpoint: input.endpoint ?? null, severity: "MEDIUM", metadataJson: JSON.stringify({ policy: input.policy, limit: input.limit }) });
    return { allowed, remaining: Math.max(0, input.limit - current - 1), retryAfterSeconds: input.windowSeconds - Math.floor((now.getTime() - windowStart.getTime()) / 1000) };
  });
}

export async function joinQueue(db: Database, input: { eventId: number; userId?: number; sessionId?: string }) {
  const existing = await db.select().from(queueEntries).where(and(eq(queueEntries.eventId, input.eventId), input.userId ? eq(queueEntries.userId, input.userId) : eq(queueEntries.sessionId, input.sessionId ?? ""), eq(queueEntries.status, "WAITING"))).limit(1);
  if (existing[0]) return { status: "WAITING" as const, queueId: existing[0].queueId, position: await queuePosition(db, input.eventId, existing[0].joinedAt) };
  const queueId = `q_${randomBytes(12).toString("hex")}`;
  await db.insert(queueEntries).values({ queueId, eventId: input.eventId, userId: input.userId ?? null, sessionId: input.sessionId ?? null });
  return { status: "WAITING" as const, queueId, position: await queuePosition(db, input.eventId, new Date()) };
}

async function queuePosition(db: Database, eventId: number, joinedAt: Date) {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(queueEntries).where(and(eq(queueEntries.eventId, eventId), eq(queueEntries.status, "WAITING"), sql`${queueEntries.joinedAt} <= ${joinedAt}`));
  return Number(rows[0]?.count ?? 1);
}

export async function queueStatus(db: Database, queueId: string) {
  const rows = await db.select().from(queueEntries).where(eq(queueEntries.queueId, queueId)).limit(1);
  if (!rows[0]) return null;
  return { status: rows[0].status, queueId, position: rows[0].status === "WAITING" ? await queuePosition(db, rows[0].eventId, rows[0].joinedAt) : 0, expiresAt: rows[0].expiresAt };
}

export async function leaveQueue(db: Database, queueId: string) {
  await db.update(queueEntries).set({ status: "LEFT" }).where(and(eq(queueEntries.queueId, queueId), eq(queueEntries.status, "WAITING")));
  return { queueId, status: "LEFT" as const };
}

export async function admitQueue(db: Database, queueId: string) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(queueEntries).where(eq(queueEntries.queueId, queueId)).for("update");
    const entry = rows[0];
    if (!entry) return null;
    const accessToken = `adm_${randomBytes(24).toString("base64url")}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await tx.update(queueEntries).set({ status: "ADMITTED", admissionTokenHash: createHash("sha256").update(accessToken).digest("hex"), admittedAt: new Date(), expiresAt }).where(eq(queueEntries.id, entry.id));
    await tx.insert(auditLogs).values({ actorType: "SYSTEM", action: "QUEUE_ADMITTED", entityType: "QUEUE", entityId: queueId });
    return { queueId, status: "ADMITTED" as const, accessToken, expiresAt };
  });
}

export async function validateAdmissionToken(db: Database, input: { eventId: number; token: string; userId?: number; sessionId?: string }) {
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const conditions = [eq(queueEntries.eventId, input.eventId), eq(queueEntries.status, "ADMITTED"), eq(queueEntries.admissionTokenHash, tokenHash), gt(queueEntries.expiresAt, new Date())];
  if (input.userId) conditions.push(eq(queueEntries.userId, input.userId));
  if (input.sessionId) conditions.push(eq(queueEntries.sessionId, input.sessionId));
  const rows = await db.select({ queueId: queueEntries.queueId }).from(queueEntries).where(and(...conditions)).limit(1);
  return Boolean(rows[0]);
}

export async function securityDashboard(db: Database) {
  const oneSecondAgo = new Date(Date.now() - 1000);
  const [eventsCount, rateLimited, duplicate, invalidTickets, replayAttempts, queueSize, activeReservations, ticketAttempts, recentRequests] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(auditLogs),
    db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(eq(securityEvents.eventType, "RATE_LIMIT_TRIGGERED")),
    db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(eq(securityEvents.eventType, "DUPLICATE_REQUEST")),
    db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(eq(securityEvents.eventType, "INVALID_SIGNATURE")),
    db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(eq(securityEvents.eventType, "REPLAY_ATTEMPT")),
    db.select({ count: sql<number>`count(*)` }).from(queueEntries).where(eq(queueEntries.status, "WAITING")),
    db.select({ count: sql<number>`count(*)` }).from(tickets).where(eq(tickets.status, "VALID")),
    db.select({ count: sql<number>`count(*)` }).from(ticketScans),
    db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(gt(securityEvents.createdAt, oneSecondAgo)),
  ]);
  const recentEvents = await db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt)).limit(20);
  const rateLimitedCount = Number(rateLimited[0]?.count ?? 0);
  const invalidTicketCount = Number(invalidTickets[0]?.count ?? 0);
  const replayCount = Number(replayAttempts[0]?.count ?? 0);
  return { totalRequests: Number(eventsCount[0]?.count ?? 0), requestsPerSecond: Number(recentRequests[0]?.count ?? 0), rateLimited: rateLimitedCount, duplicateRequests: Number(duplicate[0]?.count ?? 0), blockedRequests: rateLimitedCount + invalidTicketCount + replayCount, ticketVerificationAttempts: Number(ticketAttempts[0]?.count ?? 0), invalidTickets: invalidTicketCount, replayAttempts: replayCount, queueSize: Number(queueSize[0]?.count ?? 0), activeReservations: Number(activeReservations[0]?.count ?? 0), recentEvents };
}
