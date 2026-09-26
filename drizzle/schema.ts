import {
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("users_email_idx").on(table.email),
}));

export const venues = mysqlTable("venues", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  capacity: int("capacity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  venueId: int("venueId").notNull().references(() => venues.id),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  category: varchar("category", { length: 64 }).default("Technology").notNull(),
  description: text("description").notNull(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  status: mysqlEnum("status", ["DRAFT", "PUBLISHED", "SOLD_OUT", "CANCELLED", "COMPLETED"]).default("DRAFT").notNull(),
  maxTicketsPerUser: int("maxTicketsPerUser").default(4).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  statusIdx: index("events_status_idx").on(table.status),
  startIdx: index("events_start_time_idx").on(table.startTime),
}));

export const seats = mysqlTable("seats", {
  id: int("id").autoincrement().primaryKey(),
  venueId: int("venueId").notNull().references(() => venues.id, { onDelete: "cascade" }),
  section: varchar("section", { length: 32 }).notNull(),
  row: varchar("row", { length: 32 }).notNull(),
  number: int("number").notNull(),
  seatType: mysqlEnum("seatType", ["VIP", "PREMIUM", "STANDARD"]).default("STANDARD").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  identityIdx: uniqueIndex("seats_venue_identity_idx").on(table.venueId, table.section, table.row, table.number),
  venueIdx: index("seats_venue_idx").on(table.venueId),
}));

export const ticketTypes = mysqlTable("ticketTypes", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").notNull(),
  maxPerUser: int("maxPerUser").default(4).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("ticket_types_event_idx").on(table.eventId),
  nameIdx: uniqueIndex("ticket_types_event_name_idx").on(table.eventId, table.name),
}));

export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  seatId: int("seatId").notNull().references(() => seats.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["AVAILABLE", "RESERVED", "SOLD", "CANCELLED"]).default("AVAILABLE").notNull(),
  reservationId: int("reservationId"),
  bookingId: int("bookingId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  eventSeatIdx: uniqueIndex("inventory_event_seat_idx").on(table.eventId, table.seatId),
  statusIdx: index("inventory_status_idx").on(table.eventId, table.status),
  reservationIdx: index("inventory_reservation_idx").on(table.reservationId),
}));

export const reservations = mysqlTable("reservations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["RESERVED", "PAYMENT_PENDING", "CONFIRMED", "EXPIRED", "PAYMENT_FAILED", "CANCELLED"]).default("RESERVED").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("reservations_user_idx").on(table.userId),
  eventIdx: index("reservations_event_idx").on(table.eventId),
  statusIdx: index("reservations_status_idx").on(table.status),
  expiryIdx: index("reservations_expiry_idx").on(table.expiresAt),
}));

export const reservationItems = mysqlTable("reservationItems", {
  id: int("id").autoincrement().primaryKey(),
  reservationId: int("reservationId").notNull().references(() => reservations.id, { onDelete: "cascade" }),
  inventoryId: int("inventoryId").notNull().references(() => inventory.id, { onDelete: "cascade" }),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  reservationInventoryIdx: uniqueIndex("reservation_items_unique_idx").on(table.reservationId, table.inventoryId),
  reservationIdx: index("reservation_items_reservation_idx").on(table.reservationId),
}));

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  reservationId: int("reservationId").notNull().unique().references(() => reservations.id),
  status: mysqlEnum("status", ["PENDING", "CONFIRMED", "CANCELLED"]).default("PENDING").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("bookings_user_idx").on(table.userId),
  eventIdx: index("bookings_event_idx").on(table.eventId),
}));

export const bookingItems = mysqlTable("bookingItems", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  inventoryId: int("inventoryId").notNull().references(() => inventory.id),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  bookingInventoryIdx: uniqueIndex("booking_items_unique_idx").on(table.bookingId, table.inventoryId),
  bookingIdx: index("booking_items_booking_idx").on(table.bookingId),
}));

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  reservationId: int("reservationId").notNull().references(() => reservations.id),
  provider: varchar("provider", { length: 48 }).default("mock").notNull(),
  providerPaymentId: varchar("providerPaymentId", { length: 128 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]).default("PENDING").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  bookingIdx: index("payments_booking_idx").on(table.bookingId),
  idempotencyIdx: uniqueIndex("payments_idempotency_idx").on(table.idempotencyKey),
}));

export const tickets = mysqlTable("tickets", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  inventoryId: int("inventoryId").notNull().references(() => inventory.id),
  publicCode: varchar("publicCode", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["VALID", "CANCELLED"]).default("VALID").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  bookingIdx: index("tickets_booking_idx").on(table.bookingId),
  userIdx: index("tickets_user_idx").on(table.userId),
}));

export const idempotencyKeys = mysqlTable("idempotencyKeys", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  operation: varchar("operation", { length: 80 }).notNull(),
  requestHash: varchar("requestHash", { length: 128 }).notNull(),
  responseJson: text("responseJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  keyOperationIdx: uniqueIndex("idempotency_key_operation_idx").on(table.key, table.userId, table.operation),
  userIdx: index("idempotency_user_idx").on(table.userId),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Seat = typeof seats.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
