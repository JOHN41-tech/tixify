# Security Engine integration

Tixify keeps the booking engine authoritative. The security layer wraps it through typed procedures and service interfaces without duplicating booking transitions.

## Implemented procedures

| Procedure | Access | Purpose |
|---|---|---|
| `publicTickets.verify` | Public | Verify a signed QR payload without consuming the ticket |
| `publicTickets.scan` | Public scanner seam | Verify and atomically consume a ticket |
| `security.checkRate` | Authenticated | Apply a configurable database-backed rate policy |
| `security.status` | Admin | Security metrics and recent events |
| `queue.join` | Public | Join an event queue using user/session identity |
| `queue.status` | Public | Read server-owned queue state |

## Ticket signing interface

`createSignedTicket({ ticketId, eventId, seatId, userId, issuedAt, expiresAt, version })` returns `{ payload, payloadToken, signature, qrValue }`. It uses Ed25519 and canonical JSON. The private key is never returned to a caller.

## QR validation interface

`verifyTicketQr(qrValue)` returns either a parsed payload or a narrow invalid reason. `verifyAndScanTicket(db, { qrValue, expectedEventId, scannerId, ip })` performs database state validation and the atomic `VALID -> USED` transition.

## Required headers

- `Idempotency-Key`: accepted by reservation, booking, and payment writes.
- `X-Scanner-Id`: recommended for gate-scanner identity; the current tRPC scanner procedure also accepts `scannerId`.
- A future edge middleware can add a request/security trace ID without changing booking services.

## Rate limiting

`enforceRateLimit(db, { key, policy, limit, windowSeconds, userId, ip, endpoint })` returns `{ allowed, remaining, retryAfterSeconds }`. The current adapter persists counters in `securityRateLimits` so the state is not held in a process-local JavaScript variable. Redis can replace this adapter for horizontally scaled deployments.

Recommended Redis-compatible keys:

- `tixify:rate:{policy}:{identity}:{window}`
- `tixify:queue:{eventId}`
- `tixify:admission:{tokenHash}`
- `tixify:idempotency:{operation}:{userId}:{key}`

## Security events

`securityEvents` uses:

```json
{
  "eventType": "INVALID_SIGNATURE",
  "userId": null,
  "ipHash": "sha256…",
  "endpoint": "/api/tickets/scan",
  "timestamp": "database createdAt",
  "severity": "HIGH",
  "metadata": {}
}
```

Supported event names include `RATE_LIMIT_TRIGGERED`, `DUPLICATE_REQUEST`, `INVALID_TICKET`, `INVALID_SIGNATURE`, `REPLAY_ATTEMPT`, `QUEUE_BYPASS_ATTEMPT`, `EXCESSIVE_REQUESTS`, `MULTIPLE_FAILED_BOOKINGS`, and `TICKET_SCAN_REJECTED`.

## Audit log

`auditLogs` is append-only from the application API. It records actor type/id, action, entity type/id, metadata, and created time. Ordinary users have no procedure that can modify or delete audit records.

## Queue interface

`joinQueue` returns `{ status: "WAITING", queueId, position }`. `queueStatus` returns server-owned status and position. An admission-token implementation can be added behind this interface; the client must never be trusted to self-admit based on a timer.

## Environment variables

```bash
TICKET_SIGNING_PRIVATE_KEY=
TICKET_SIGNING_PUBLIC_KEY=
SECURITY_RATE_LIMIT_REQUESTS_PER_SECOND=10
SECURITY_RATE_LIMIT_BURST=25
SECURITY_RATE_LIMIT_WINDOW_SECONDS=1
REDIS_URL=
```

Keys must be injected through a secret manager in production. Do not commit real values.

## Integration rule

Person 1 remains responsible for users, events, venues, seats, inventory, reservations, bookings, and payments. Security code may observe domain events and wrap API procedures, but must not directly mutate inventory or bypass booking transactions.
