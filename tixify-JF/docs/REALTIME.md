# Realtime inventory

After a successful inventory transaction, the booking service publishes a domain event through `server/events.ts`. The Express server maps event-specific messages to an SSE stream at `/api/events/:eventId/stream`. Connected seat maps refresh their typed query when they receive `SEAT_STATUS_CHANGED`.

The current managed single-process deployment uses the event bus in memory. For horizontal scaling, replace the `publishDomainEvent`/`subscribeInventory` implementation with Redis Pub/Sub; no booking service or frontend contract needs to change.

The browser may show a seat as available for a moment after another customer wins a race. This is expected and safe: the next reservation transaction revalidates the database state and rejects stale selections. SSE is a synchronization aid, never an authority.

The stream emits heartbeat comments so proxies keep the connection open. Each client unsubscribes from the in-process event bus when its request closes. The scheduled expiry endpoint is designed to be called by the managed heartbeat/cron facility at least once per minute; no frontend action is required to release a reservation.
