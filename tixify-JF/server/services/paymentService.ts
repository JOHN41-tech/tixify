import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { payments } from "../../drizzle/schema";
import type { Database } from "../db";

export type MockPaymentOutcome = "success" | "failure";

export interface PaymentProvider {
  createPayment(input: { amount: number; reference: string; outcome: MockPaymentOutcome }): Promise<{ providerPaymentId: string; clientSecret: string }>;
  verifyPayment(providerPaymentId: string): Promise<{ status: "SUCCEEDED" | "FAILED"; providerPaymentId: string }>;
  handleWebhook(input: { providerPaymentId: string; status: "SUCCEEDED" | "FAILED" }): Promise<{ status: "SUCCEEDED" | "FAILED"; providerPaymentId: string }>;
  refundPayment(providerPaymentId: string): Promise<{ status: "REFUNDED"; providerPaymentId: string }>;
}

const outcomes = new Map<string, MockPaymentOutcome>();

export const mockPaymentProvider: PaymentProvider = {
  async createPayment({ amount, reference, outcome }) {
    const providerPaymentId = `mock_${randomUUID()}`;
    outcomes.set(providerPaymentId, outcome);
    const clientSecret = createHash("sha256").update(`${providerPaymentId}:${amount}:${reference}`).digest("hex");
    return { providerPaymentId, clientSecret };
  },
  async verifyPayment(providerPaymentId) {
    const outcome = outcomes.get(providerPaymentId) ?? "failure";
    return { providerPaymentId, status: outcome === "success" ? "SUCCEEDED" : "FAILED" };
  },
  async handleWebhook({ providerPaymentId, status }) {
    return { providerPaymentId, status };
  },
  async refundPayment(providerPaymentId) {
    outcomes.set(providerPaymentId, "failure");
    return { providerPaymentId, status: "REFUNDED" };
  },
};

export async function findPayment(db: Database, providerPaymentId: string) {
  const rows = await db.select().from(payments).where(eq(payments.providerPaymentId, providerPaymentId)).limit(1);
  return rows[0];
}

export async function findPaymentByIdempotency(db: Database, key: string, bookingId: number) {
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.idempotencyKey, key), eq(payments.bookingId, bookingId)))
    .limit(1);
  return rows[0];
}
