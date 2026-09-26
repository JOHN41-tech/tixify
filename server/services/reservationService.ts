import { TRPCError } from "@trpc/server";

export const RESERVATION_MINUTES = 5;

export type ReservationStatus =
  | "RESERVED"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "EXPIRED"
  | "PAYMENT_FAILED"
  | "CANCELLED";

const transitions: Record<ReservationStatus, ReservationStatus[]> = {
  RESERVED: ["PAYMENT_PENDING", "EXPIRED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "PAYMENT_FAILED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  EXPIRED: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
};

export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus) {
  if (!transitions[from]?.includes(to)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid reservation transition: ${from} -> ${to}`,
    });
  }
}

export function reservationExpiry(now = new Date()) {
  return new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000);
}

export function money(value: string | number | null | undefined) {
  return Number(Number(value ?? 0).toFixed(2));
}

export function sumMoney(values: Array<string | number | null | undefined>) {
  return Number(values.reduce<number>((total, value) => total + money(value), 0).toFixed(2));
}
