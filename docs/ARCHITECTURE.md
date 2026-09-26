# Tixify architecture

## Scope

Tixify is the **core booking platform plus a modular security engine**. It owns authoritative event, venue, seat, inventory, reservation, payment, booking, and ticket state. The security engine adds signed tickets, atomic scan replay protection, database-backed rate limiting, audit/security events, and a virtual queue contract without mutating inventory outside booking transactions.

## Runtime

- React 19 + TypeScript + Tailwind via Vite
- Express server with tRPC procedures under `/api/trpc`
- Drizzle ORM over MySQL/TiDB (the managed WebDev database)
- Server-Sent Events for live inventory updates at `/api/events/:eventId/stream`
- Managed scheduled callback at `/api/scheduled/expire-reservations`

The current hosted runtime is a single web server process. The database remains authoritative; in-process events are an optimization for connected clients and are never used to decide whether a seat can be booked.

## Layers

```text
Browser UI
  -> signed QR / typed tRPC procedures / SSE inventory stream
    -> rate-limit middleware + router validation + auth / admin middleware
      -> security services (signature, scan, audit, queue)
        -> booking services (transactions, state transitions, payment abstraction)
          -> Drizzle/MySQL source of truth
            -> domain event bus -> connected SSE clients
```

Business logic is in `server/services`, not UI components. The `PaymentProvider` interface is replaceable. `server/services/securityService.ts` owns cryptographic ticket identity, scan replay protection, audit/security persistence, rate-limit counters, and queue state. `server/events.ts` remains the internal domain event seam for future Redis/bot/fraud consumers.

## Frontend architecture

- Public discovery: `/`, `/events`, `/events/:eventId`
- Transactional flow: `/checkout`, `/booking/:bookingId`
- Authenticated wallet: `/tickets`, `/account/bookings`
- Protected operations console: `/admin/*`
- `client/src/lib/trpc.ts` provides the end-to-end contract.
- Frontend state is optimistic only for visual selection. A reservation is accepted only after the database transaction succeeds.

## Booking lifecycle

1. User opens a published event.
2. UI reads live seat status from the database-backed query.
3. `reservations.create` locks the user row and all selected inventory rows in one transaction.
4. It checks event status, seat state, purchase limits, price, and writes the reservation plus inventory updates atomically.
5. Checkout creates a pending booking and a mock payment intent.
6. `payments.verify` or `payments.webhook` verifies payment server-side.
7. Only successful settlement changes inventory to `SOLD`, marks the booking/reservation confirmed, and creates tickets.
8. Failed, cancelled, or expired reservations release inventory.

## Security integration

The Express boundary applies database-backed rate limits to tRPC writes. `publicTickets.verify` is non-consuming; `publicTickets.scan` atomically transitions a valid ticket from `VALID` to `USED`. Every write accepts an `Idempotency-Key` header. Core emits domain events (`ReservationCreated`, `SeatReserved`, `PaymentSucceeded`, `BookingConfirmed`, etc.) for future distributed consumers.

## Directory structure

```text
client/src/pages/       Public, checkout, wallet, and admin screens
client/src/App.tsx      Route map
drizzle/schema.ts       Normalized MySQL schema
server/db.ts            Read helpers and database access
server/routers.ts       Typed API contract
server/services/        Reservation, payment, and booking transactions
server/events.ts        Internal domain event bus
server/_core/index.ts   Express + realtime + scheduled callback
server/seed.ts          Development seed data
docs/                   Architecture and integration contracts
```
