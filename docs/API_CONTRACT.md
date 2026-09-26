# API contract

Tixify exposes typed tRPC procedures under `/api/trpc`. The procedure names map directly to the REST-style operations required by the product brief.

## Public

| Procedure | Input | Purpose |
| --- | --- | --- |
| `events.list` | none | Published events |
| `events.get` | `{ eventId }` | Event details and ticket types |
| `events.seats` | `{ eventId }` | Authoritative seat state |
| `publicTickets.get` | `{ publicCode }` | Resolve a scanned ticket code into a public view |
| `publicTickets.verify` | `{ qrValue, eventId? }` | Verify a signed QR without consuming the ticket |
| `publicTickets.scan` | `{ qrValue, eventId?, scannerId? }` | Verify and atomically consume a ticket |
| `queue.join` | `{ eventId, sessionId? }` | Enter the server-owned event queue |
| `queue.status` | `{ queueId }` | Read queue position and admission state |
| `queue.leave` | `{ queueId }` | Leave a waiting queue |
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
| `tickets.mine` | none | Wallet tickets with signed QR fields |
| `tickets.get` | `{ ticketId }` | User-owned ticket |
| `security.checkRate` | `{ policy, limit, windowSeconds, scope }` | Apply a configurable rate policy |
| `queue.validate` | `{ eventId, accessToken, sessionId? }` | Validate an expiring admission token |

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
- `security.status`
- `queue.admit`

## Idempotency

Write calls accept `Idempotency-Key` as an HTTP header. The reservation service persists the key, authenticated user, operation, request hash, lifecycle status, response, and a 24-hour expiration timestamp. Repeating the same request returns the original success response. Reusing a key for a different payload returns a conflict. A concurrent request that finds `PROCESSING` receives a conflict and must retry with the same key after the original request completes. The database unique constraint prevents duplicate ownership of a key.

## Rate limiting

The Express `/api/trpc` boundary applies different policies to sensitive writes, queue/read procedures, and other requests. When `REDIS_URL` is configured, atomic Redis `INCR`/`EXPIRE` counters are used. Without Redis, the managed database counter table provides a non-process-local development fallback. Rejections return HTTP 429 with `RATE_LIMITED` and `Retry-After`.

## Errors

Errors are mapped to safe tRPC errors; database details and stack traces are not returned to users. Security results are intentionally narrow: `VALID`, `ALREADY_USED`, `EXPIRED`, `INVALID_SIGNATURE`, `TICKET_NOT_FOUND`, `CANCELLED`, and `WRONG_EVENT`. Core codes include `EVENT_NOT_FOUND`, `EVENT_NOT_BOOKABLE`, `SEAT_NOT_FOUND`, `SEAT_UNAVAILABLE`, `PURCHASE_LIMIT_EXCEEDED`, `RESERVATION_EXPIRED`, `PAYMENT_FAILED`, `PAYMENT_REQUIRED`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`, and `INVALID_REQUEST`.

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
