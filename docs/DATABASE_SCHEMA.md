# Database schema

The database is the source of truth. All timestamps are stored as UTC database timestamps and are converted for display in the browser.

## Entities

- `users`: managed identity, email, and server-side `user`/`admin` role.
- `venues`: named physical venue and capacity.
- `events`: published schedule, lifecycle state, venue, and per-user ticket limit.
- `seats`: stable seat identity unique within a venue (`venueId`, `section`, `row`, `number`).
- `ticketTypes`: authoritative event pricing and quantity categories.
- `inventory`: one row per event-seat pair. Its state is `AVAILABLE`, `RESERVED`, `SOLD`, or `CANCELLED`.
- `reservations`: user/event hold, lifecycle state, expiry, and total.
- `reservationItems`: seats and authoritative unit prices in a reservation.
- `bookings`: one per reservation, initially `PENDING`, later `CONFIRMED` or `CANCELLED`.
- `bookingItems`: seats attached to a booking.
- `payments`: provider ID, amount, status, and idempotency information.
- `tickets`: generated only after successful payment settlement.
- `idempotencyKeys`: persisted request keys and original response data.

## Constraints and indexes

- Unique user `openId`.
- Unique event slug.
- Unique venue seat identity.
- Unique event/seat inventory pair.
- Unique reservation per booking.
- Unique provider payment ID and ticket public code.
- Unique `(key, userId, operation)` idempotency key.
- Foreign keys with cascade rules for owned child rows.
- Indexes cover event status/time, inventory state, reservation user/event/status/expiry, booking user/event, and ticket ownership.

## Important implementation note

Inventory rows are deliberately modeled per event-seat pair rather than storing a seat's current status on the reusable `seats` row. The same physical seat can therefore participate in multiple events with independent inventory state.
