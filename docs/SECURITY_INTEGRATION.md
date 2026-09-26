# Security Engine integration

Tixify intentionally does not implement fraud detection, rate limiting, bot mitigation, virtual queueing, QR verification, or cryptographic ticket signing. Those capabilities belong to Person 2.

## Middleware seam

Security middleware can intercept the Express request before `/api/trpc`, or wrap the typed procedures. It should preserve the authenticated user context and pass a decision/trace ID downstream. The booking services do not need to know which security policy made the request admissible.

## Idempotency seam

Reservation, booking, and payment creation accept the `Idempotency-Key` header. The core persists reservation keys for correctness even if centralized middleware is added later. Person 2 may enforce a global key policy before the service call without changing the request shape.

## Event seam

Subscribe to `onDomainEvent` in `server/events.ts` for `ReservationCreated`, `ReservationExpired`, `ReservationCancelled`, `PaymentSucceeded`, `PaymentFailed`, `BookingConfirmed`, `SeatReserved`, `SeatReleased`, and `SeatSold`. Consumers should be observational or enqueue work; they must not mutate inventory directly.

## Ticket hook

Successful payment settlement is the only place that creates tickets. Replace the `tickets` insert in `settlePayment` with a signed-ticket adapter when Person 2 is ready. The adapter should receive `bookingId`, `userId`, `eventId`, `inventoryId`, and the generated public code, then persist the signed payload or verification metadata without changing the booking lifecycle.
