# API contract

Tixify currently exposes typed tRPC procedures under `/api/trpc`. The procedure names map directly to the REST-style operations required by the product brief.

## Public

| Procedure | Input | Purpose |
| --- | --- | --- |
| `events.list` | none | Published events |
| `events.get` | `{ eventId }` | Event details and ticket types |
| `events.seats` | `{ eventId }` | Authoritative seat state |
| `publicTickets.get` | `{ publicCode }` | Resolve a scanned QR ticket code into a public verification view |
| `reservations.expire` | none | Scheduled cleanup callback |
| `payments.webhook` | `{ providerPaymentId, status, signature? }` | Idempotent provider callback |

## Protected

| Procedure | Input | Purpose |
| --- | --- | --- |
| `reservations.create` | `{ eventId, seatIds, idempotencyKey? }` | Transactional seat hold |
| `reservations.get` | `{ reservationId }` | User-owned reservation |
| `reservations.cancel` | `{ reservationId }` | Release an active hold |
| `bookings.create` | `{ reservationId, idempotencyKey? }` | Create pending booking |
| `bookings.get` | `{ bookingId }` | User-owned booking and tickets |
| `bookings.mine` | none | Booking history |
| `payments.create` | `{ reservationId, outcome, idempotencyKey? }` | Mock provider intent |
| `payments.verify` | `{ providerPaymentId }` | Server-side verification and settlement |
| `tickets.mine` | none | Wallet tickets |
| `tickets.get` | `{ ticketId }` | User-owned ticket |

## Admin

Admin procedures are protected by `adminProcedure`, which checks the server-side authenticated user role. The client cannot promote itself.

- `admin.createVenue`
- `admin.createEvent`
- `admin.publishEvent`
- `admin.cancelEvent`
- `admin.createSeats`
- `admin.bookings`
- `admin.reservations`
- `admin.inventory`

## Idempotency

Write calls accept `Idempotency-Key` as an HTTP header. The reservation service persists the key, authenticated user, operation, request hash, and response. Repeating the same request returns the original result. Reusing a key for a different payload returns a conflict. Person 2 can replace or wrap this with a centralized idempotency middleware without changing booking logic.

## Errors

Errors are mapped to safe tRPC errors; database details and stack traces are not returned to users. Core codes include `EVENT_NOT_FOUND`, `EVENT_NOT_BOOKABLE`, `SEAT_NOT_FOUND`, `SEAT_UNAVAILABLE`, `PURCHASE_LIMIT_EXCEEDED`, `RESERVATION_EXPIRED`, `PAYMENT_FAILED`, `PAYMENT_REQUIRED`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, and `INVALID_REQUEST`.

## Realtime

`GET /api/events/:eventId/stream` is an SSE stream. Events use this shape:

```json
{
  "type": "SEAT_STATUS_CHANGED",
  "eventId": 1,
  "seatId": 42,
  "status": "RESERVED"
}
```

The message updates the UI only. The database query and transactional reservation are still authoritative.
