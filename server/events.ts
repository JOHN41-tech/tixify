import { EventEmitter } from "node:events";

export type DomainEvent = {
  type:
    | "ReservationCreated"
    | "ReservationExpired"
    | "ReservationCancelled"
    | "PaymentSucceeded"
    | "PaymentFailed"
    | "BookingConfirmed"
    | "SeatReserved"
    | "SeatReleased"
    | "SeatSold";
  eventId: number;
  reservationId?: number;
  bookingId?: number;
  seatIds?: number[];
  at: string;
};

const bus = new EventEmitter();
bus.setMaxListeners(500);

export function publishDomainEvent(event: DomainEvent) {
  bus.emit("domain", event);
  if (event.seatIds) {
    for (const seatId of event.seatIds) {
      bus.emit(`inventory:${event.eventId}`, {
        type: "SEAT_STATUS_CHANGED",
        eventId: event.eventId,
        seatId,
        status:
          event.type === "SeatReserved"
            ? "RESERVED"
            : event.type === "SeatSold"
              ? "SOLD"
              : "AVAILABLE",
      });
    }
  }
}

export function onDomainEvent(listener: (event: DomainEvent) => void) {
  bus.on("domain", listener);
  return () => bus.off("domain", listener);
}

export function subscribeInventory(eventId: number, listener: (payload: unknown) => void) {
  const topic = `inventory:${eventId}`;
  bus.on(topic, listener);
  return () => bus.off(topic, listener);
}
