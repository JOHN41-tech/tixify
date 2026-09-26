import { describe, expect, it } from "vitest";
import { evaluateBotSignals, createSignedTicket, verifyTicketQr } from "../services/securityService";

type Result = { ok: boolean; latencyMs: number };

async function runLoad(size: number, handler: (index: number) => Promise<boolean>): Promise<Result[]> {
  const started = performance.now();
  const output = await Promise.all(Array.from({ length: size }, (_, index) => handler(index)));
  const latencyMs = performance.now() - started;
  return output.map((ok) => ({ ok, latencyMs }));
}

describe("security load models", () => {
  it.each([100, 500, 1000, 5000])("keeps the deterministic rate-limit decision consistent at %i requests", async (size) => {
    const results = await runLoad(size, async (index) => index < 60);
    expect(results.filter((result) => result.ok)).toHaveLength(Math.min(size, 60));
    expect(results.every((result) => Number.isFinite(result.latencyMs))).toBe(true);
  });

  it("validates signed tickets under repeated verification load without accepting tampering", async () => {
    const signed = createSignedTicket({ ticketId: "TIX-LOAD", eventId: "1", seatId: "2", userId: "3", issuedAt: new Date().toISOString(), expiresAt: null });
    const results = await runLoad(1000, async () => verifyTicketQr(signed.qrValue).valid);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(verifyTicketQr(`${signed.qrValue}x`).valid).toBe(false);
  });

  it("keeps bot decisions deterministic for burst signals", () => {
    expect(evaluateBotSignals({ requestsInWindow: 5, duplicateRequests: 0, failedBookings: 0, rapidSeatChanges: 0 })).toBe("NORMAL");
    expect(evaluateBotSignals({ requestsInWindow: 20, duplicateRequests: 4, failedBookings: 1, rapidSeatChanges: 1 })).toBe("CHALLENGE");
    expect(evaluateBotSignals({ requestsInWindow: 250, duplicateRequests: 0, failedBookings: 0, rapidSeatChanges: 0 })).toBe("TEMPORARY_RESTRICTION");
  });
});
