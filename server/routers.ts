import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, getBookingDetails, getEventDetails, getEventSeats, getReservationDetails, listAdminBookings, listAdminInventory, listAdminReservations, listPublishedEvents, listUserBookings, listUserTickets } from "./db";
import { createBooking, createPayment, createReservation, cancelReservation, expireReservations, handlePaymentWebhook, verifyPayment, BookingError } from "./services/bookingService";
import { events, inventory, seats, ticketTypes, tickets, venues } from "../drizzle/schema";

const idSchema = z.number().int().positive();
const seatListSchema = z.array(idSchema).min(1).max(10);

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is not available." });
  return db;
}

function serviceError(error: unknown): never {
  if (error instanceof BookingError) {
    const codeMap: Record<string, TRPCError["code"]> = {
      INVALID_REQUEST: "BAD_REQUEST",
      IDEMPOTENCY_CONFLICT: "CONFLICT",
      EVENT_NOT_FOUND: "NOT_FOUND",
      EVENT_NOT_BOOKABLE: "BAD_REQUEST",
      SEAT_NOT_FOUND: "NOT_FOUND",
      SEAT_UNAVAILABLE: "CONFLICT",
      PURCHASE_LIMIT_EXCEEDED: "CONFLICT",
      RESERVATION_NOT_FOUND: "NOT_FOUND",
      RESERVATION_EXPIRED: "BAD_REQUEST",
      PAYMENT_REQUIRED: "BAD_REQUEST",
      PAYMENT_FAILED: "BAD_REQUEST",
      UNAUTHORIZED: "UNAUTHORIZED",
    };
    throw new TRPCError({ code: codeMap[error.code] ?? "BAD_REQUEST", message: error.message });
  }
  throw error;
}

function idempotencyKey(req: { headers: Record<string, string | string[] | undefined> }, fallback?: string) {
  const header = req.headers["idempotency-key"];
  return (Array.isArray(header) ? header[0] : header) ?? fallback;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  events: router({
    list: publicProcedure.query(() => listPublishedEvents()),
    get: publicProcedure.input(z.object({ eventId: idSchema })).query(async ({ input }) => {
      const event = await getEventDetails(input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
      return event;
    }),
    seats: publicProcedure.input(z.object({ eventId: idSchema })).query(({ input }) => getEventSeats(input.eventId)),
  }),
  reservations: router({
    create: protectedProcedure.input(z.object({ eventId: idSchema, seatIds: seatListSchema, idempotencyKey: z.string().min(8).max(128).optional() })).mutation(async ({ ctx, input }) => {
      try {
        const result = await createReservation(await dbOrThrow(), { userId: ctx.user.id, eventId: input.eventId, seatIds: input.seatIds, idempotencyKey: idempotencyKey(ctx.req, input.idempotencyKey) });
        return { success: true, data: result };
      } catch (error) { return serviceError(error); }
    }),
    get: protectedProcedure.input(z.object({ reservationId: idSchema })).query(async ({ ctx, input }) => {
      const result = await getReservationDetails(input.reservationId, ctx.user.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Reservation not found." });
      return result;
    }),
    cancel: protectedProcedure.input(z.object({ reservationId: idSchema })).mutation(async ({ ctx, input }) => {
      try { return await cancelReservation(await dbOrThrow(), { userId: ctx.user.id, reservationId: input.reservationId }); }
      catch (error) { return serviceError(error); }
    }),
    expire: publicProcedure.mutation(async () => ({ expired: await expireReservations(await dbOrThrow()) })),
  }),
  bookings: router({
    create: protectedProcedure.input(z.object({ reservationId: idSchema, idempotencyKey: z.string().min(8).max(128).optional() })).mutation(async ({ ctx, input }) => {
      try { return await createBooking(await dbOrThrow(), { userId: ctx.user.id, reservationId: input.reservationId, idempotencyKey: idempotencyKey(ctx.req, input.idempotencyKey) }); }
      catch (error) { return serviceError(error); }
    }),
    get: protectedProcedure.input(z.object({ bookingId: idSchema })).query(async ({ ctx, input }) => {
      const result = await getBookingDetails(input.bookingId, ctx.user.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Booking not found." });
      return result;
    }),
    mine: protectedProcedure.query(({ ctx }) => listUserBookings(ctx.user.id)),
  }),
  payments: router({
    create: protectedProcedure.input(z.object({ reservationId: idSchema, outcome: z.enum(["success", "failure"]).default("success"), idempotencyKey: z.string().min(8).max(128).optional() })).mutation(async ({ ctx, input }) => {
      try { return await createPayment(await dbOrThrow(), { userId: ctx.user.id, reservationId: input.reservationId, outcome: input.outcome, idempotencyKey: idempotencyKey(ctx.req, input.idempotencyKey) }); }
      catch (error) { return serviceError(error); }
    }),
    verify: protectedProcedure.input(z.object({ providerPaymentId: z.string().min(8) })).mutation(async ({ ctx, input }) => {
      try { return await verifyPayment(await dbOrThrow(), { userId: ctx.user.id, providerPaymentId: input.providerPaymentId }); }
      catch (error) { return serviceError(error); }
    }),
    webhook: publicProcedure.input(z.object({ providerPaymentId: z.string().min(8), status: z.enum(["SUCCEEDED", "FAILED"]), signature: z.string().optional() })).mutation(async ({ input }) => {
      try { return await handlePaymentWebhook(await dbOrThrow(), { providerPaymentId: input.providerPaymentId, status: input.status }); }
      catch (error) { return serviceError(error); }
    }),
  }),
  tickets: router({
    mine: protectedProcedure.query(({ ctx }) => listUserTickets(ctx.user.id)),
    get: protectedProcedure.input(z.object({ ticketId: idSchema })).query(async ({ ctx, input }) => {
      const db = await dbOrThrow();
      const rows = await db.select().from(tickets).where(and(eq(tickets.id, input.ticketId), eq(tickets.userId, ctx.user.id))).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Ticket not found." });
      return rows[0];
    }),
  }),
  admin: router({
    events: adminProcedure.query(() => listPublishedEvents()),
    createVenue: adminProcedure.input(z.object({ name: z.string().min(2).max(160), address: z.string().min(2).max(255), capacity: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const result = await db.insert(venues).values(input);
      return { id: Number(result[0].insertId) };
    }),
    createEvent: adminProcedure.input(z.object({ venueId: idSchema, name: z.string().min(2).max(180), slug: z.string().min(2).max(180), description: z.string().min(10), startTime: z.coerce.date(), endTime: z.coerce.date(), maxTicketsPerUser: z.number().int().min(1).max(20), ticketTypes: z.array(z.object({ name: z.string().min(2), price: z.number().nonnegative(), quantity: z.number().int().positive(), maxPerUser: z.number().int().positive() })).min(1) })).mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const result = await db.insert(events).values({ venueId: input.venueId, name: input.name, slug: input.slug, description: input.description, startTime: input.startTime, endTime: input.endTime, maxTicketsPerUser: input.maxTicketsPerUser, status: "DRAFT" });
      const eventId = Number(result[0].insertId);
      await db.insert(ticketTypes).values(input.ticketTypes.map((type) => ({ ...type, eventId, price: type.price.toFixed(2) })));
      return { id: eventId, status: "DRAFT" as const };
    }),
    publishEvent: adminProcedure.input(z.object({ eventId: idSchema })).mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db.update(events).set({ status: "PUBLISHED", updatedAt: new Date() }).where(eq(events.id, input.eventId));
      return { success: true };
    }),
    cancelEvent: adminProcedure.input(z.object({ eventId: idSchema })).mutation(async ({ input }) => {
      const db = await dbOrThrow();
      await db.update(events).set({ status: "CANCELLED", updatedAt: new Date() }).where(eq(events.id, input.eventId));
      return { success: true };
    }),
    createSeats: adminProcedure.input(z.object({ eventId: idSchema, venueId: idSchema, seats: z.array(z.object({ section: z.string().min(1).max(32), row: z.string().min(1).max(32), number: z.number().int().positive(), seatType: z.enum(["VIP", "PREMIUM", "STANDARD"]) })).min(1) })).mutation(async ({ input }) => {
      const db = await dbOrThrow();
      const seatRows = await db.insert(seats).values(input.seats.map((seat) => ({ ...seat, venueId: input.venueId })));
      const firstId = Number(seatRows[0].insertId);
      const createdSeats = await db.select().from(seats).where(and(eq(seats.venueId, input.venueId), inArray(seats.number, input.seats.map((seat) => seat.number))));
      await db.insert(inventory).values(createdSeats.map((seat) => ({ eventId: input.eventId, seatId: seat.id, status: "AVAILABLE" as const })));
      return { firstId, count: createdSeats.length };
    }),
    bookings: adminProcedure.query(() => listAdminBookings()),
    reservations: adminProcedure.query(() => listAdminReservations()),
    inventory: adminProcedure.input(z.object({ eventId: idSchema })).query(({ input }) => listAdminInventory(input.eventId)),
  }),
});

export type AppRouter = typeof appRouter;
