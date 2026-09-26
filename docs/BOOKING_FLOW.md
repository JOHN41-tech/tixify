# Booking flow

## Reservation

A user selects seats and submits `reservations.create`. The server validates the authenticated identity and published event, locks the user row, locks every requested inventory row, re-reads each authoritative state, checks the purchase limit, calculates the database price, then inserts the reservation and reservation items while moving inventory to `RESERVED`. Any error rolls back the entire transaction.

Reservations expire after five minutes. The scheduled callback invokes `POST /api/scheduled/expire-reservations`; the cleanup transaction marks eligible holds `EXPIRED` and returns their inventory to `AVAILABLE`. The browser is never required to perform cleanup.

## Payment and booking

`bookings.create` creates a `PENDING` booking for a valid reservation and keeps inventory reserved. `payments.create` creates a server-side mock provider intent. `payments.verify` calls the provider abstraction and then settles inside a transaction. On success, payment becomes `SUCCEEDED`, the reservation and booking become confirmed, inventory becomes `SOLD`, and one ticket is created per booking item. On failure, payment becomes `FAILED`, booking becomes cancelled, reservation becomes `PAYMENT_FAILED`, and inventory is released.

Repeated webhook notifications are safe because payment rows are locked and terminal statuses are returned as duplicate results. A provider payment can never create a second booking because `bookings.reservationId` is unique.

## Allowed reservation transitions

```text
RESERVED -> PAYMENT_PENDING | EXPIRED | CANCELLED
PAYMENT_PENDING -> CONFIRMED | PAYMENT_FAILED | EXPIRED | CANCELLED
CONFIRMED -> CANCELLED
```

Arbitrary client-provided statuses are ignored. Only service methods can transition state.
