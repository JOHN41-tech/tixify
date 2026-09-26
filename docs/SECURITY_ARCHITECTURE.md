# Tixify Security Engine

## Scope

The security engine is a modular protection layer around the Person 1 booking platform. It does not own users, events, venues, seats, inventory, reservations, bookings, payments, or the booking state machine. It consumes the existing ticket-creation seam and exposes security decisions through typed interfaces.

## Layers

```text
Signed ticket identity
  -> QR parsing and Ed25519 verification
    -> database existence / event / state / expiry checks
      -> atomic CONFIRMED/VALID -> USED transition
        -> ticket scan + audit records

Request security
  -> existing idempotency keys on reservation/payment/booking writes
  -> database-backed rate-limit counters
  -> standardized security events

Traffic security
  -> queue entries and admission status
  -> configurable policy seam for future Redis-backed admission tokens

All layers
  -> securityEvents + auditLogs
  -> admin security monitor
```

## Cryptographic tickets

Confirmed tickets receive a compact signed QR value:

```text
tix1.<base64url canonical payload>.<base64url Ed25519 signature>
```

The payload contains only ticket identity and lifecycle fields:

```json
{
  "v": 1,
  "ticketId": "TIX-...",
  "eventId": "42",
  "seatId": "1001",
  "userId": "3",
  "issuedAt": "2026-09-26T05:00:00.000Z",
  "expiresAt": null,
  "version": 1
}
```

No password, payment secret, database credential, or private signing key enters the QR value. The private Ed25519 key is server-only. Public and private keys are configured with `TICKET_SIGNING_PRIVATE_KEY` and `TICKET_SIGNING_PUBLIC_KEY`; development can use an ephemeral key pair, while production should fail closed at deployment configuration review if keys are missing.

## Verification and replay protection

`publicTickets.verify` validates structure, signature, ticket identity, event binding, cancellation, expiry, and state. `publicTickets.scan` performs the same checks and atomically locks the ticket row. Only one concurrent scanner can transition a valid ticket to `USED`; later scans return `ALREADY_USED` and are recorded in `ticketScans` and `securityEvents`.

## Request and traffic protection

- Reservation, booking, and payment procedures already accept `Idempotency-Key` and persist request hashes in `idempotencyKeys`.
- `security.checkRate` provides a configurable database-backed counter policy for authenticated middleware and endpoint adapters.
- `queue.join` and `queue.status` provide the virtual queue contract. Queue records are server-owned and status is never inferred from a client countdown.
- `securityEvents` records invalid signatures, rate-limit triggers, replay attempts, duplicate requests, and future bot/challenge decisions.

For multi-instance production, replace or front the database counter and queue adapters with Redis using the same service interfaces. Suggested Redis keys are `tixify:rate:{policy}:{identity}:{window}`, `tixify:queue:{eventId}`, and `tixify:admission:{tokenHash}`.

## Admin monitoring

Admins can use the security monitor to view audit volume, rate-limit events, invalid QR attempts, replay attempts, queue size, valid tickets, and recent security events. Personal identifiers are not shown in the dashboard; IP values are stored only as SHA-256 hashes.

## Key rotation

1. Generate a new Ed25519 key pair in the secret manager.
2. Deploy the public key and private key together during a controlled rotation window.
3. Existing tickets retain their signature and version. If long-lived tickets need rollover support, add a `keyId` to the payload and keep the previous public key available for verification until all tickets expire.
4. Never place either key in frontend code, database rows, QR payloads, logs, or Git history.

## Error policy

External verification responses are intentionally narrow: `VALID`, `ALREADY_USED`, `EXPIRED`, `INVALID_SIGNATURE`, `TICKET_NOT_FOUND`, `CANCELLED`, and `WRONG_EVENT`. Internal database details and user records are not revealed to scanners.
