import { describe, expect, it } from "vitest";
import { assertReservationTransition, money, reservationExpiry, sumMoney } from "./reservationService";

describe("reservation invariants", () => {
  it("allows only explicit lifecycle transitions", () => {
    expect(() => assertReservationTransition("RESERVED", "PAYMENT_PENDING")).not.toThrow();
    expect(() => assertReservationTransition("PAYMENT_PENDING", "CONFIRMED")).not.toThrow();
    expect(() => assertReservationTransition("CONFIRMED", "RESERVED")).toThrow();
    expect(() => assertReservationTransition("EXPIRED", "CONFIRMED")).toThrow();
  });

  it("uses a five-minute expiry window", () => {
    const now = new Date("2026-09-26T10:00:00.000Z");
    expect(reservationExpiry(now).toISOString()).toBe("2026-09-26T10:05:00.000Z");
  });

  it("keeps currency math deterministic", () => {
    expect(money("149.00")).toBe(149);
    expect(sumMoney(["0.10", "0.20", 0.3])).toBe(0.6);
  });
});
