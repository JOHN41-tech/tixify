import { describe, expect, it } from "vitest";
import { createSignedTicket, parseTicketQr, verifyTicketQr } from "./securityService";

describe("cryptographic ticket security", () => {
  it("creates a compact signed QR payload that verifies", () => {
    const signed = createSignedTicket({ ticketId: "TIX-ABC123", eventId: "42", seatId: "1001", userId: "7", issuedAt: new Date().toISOString(), expiresAt: null });
    expect(signed.qrValue.startsWith("tix1.")).toBe(true);
    expect(parseTicketQr(signed.qrValue)?.payload.ticketId).toBe("TIX-ABC123");
    expect(verifyTicketQr(signed.qrValue)).toMatchObject({ valid: true, payload: { eventId: "42" } });
  });

  it("rejects modified payloads and malformed QR values", () => {
    const signed = createSignedTicket({ ticketId: "TIX-TAMPER", eventId: "42", seatId: "1001", userId: "7", issuedAt: new Date().toISOString(), expiresAt: null });
    const parsed = parseTicketQr(signed.qrValue)!;
    const modifiedPayload = Buffer.from(JSON.stringify({ ...parsed.payload, eventId: "99" })).toString("base64url");
    expect(verifyTicketQr(`tix1.${modifiedPayload}.${parsed.signature}`)).toEqual({ valid: false, reason: "INVALID_SIGNATURE" });
    expect(verifyTicketQr("not-a-ticket")).toEqual({ valid: false, reason: "MALFORMED" });
  });
});

describe("replay protection model", () => {
  it("allows exactly one state transition from VALID to USED", async () => {
    let state: "VALID" | "USED" = "VALID";
    const scan = async () => {
      if (state !== "VALID") return "ALREADY_USED";
      await Promise.resolve();
      if (state !== "VALID") return "ALREADY_USED";
      state = "USED";
      return "VALID";
    };
    const results = await Promise.all(Array.from({ length: 25 }, () => scan()));
    expect(results.filter((result) => result === "VALID")).toHaveLength(1);
    expect(results.filter((result) => result === "ALREADY_USED")).toHaveLength(24);
  });
});
