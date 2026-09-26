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
  organizerId: int("organizerId").references(() => users.id, { onDelete: "set null" }),
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
  status: mysqlEnum("status", ["VALID", "USED", "CANCELLED"]).default("VALID").notNull(),
  ticketVersion: int("ticketVersion").default(1).notNull(),
  signedPayload: text("signedPayload"),
  signature: varchar("signature", { length: 128 }),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  usedAt: timestamp("usedAt"),
  usedBy: varchar("usedBy", { length: 128 }),
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
  status: mysqlEnum("status", ["PROCESSING", "SUCCESS", "FAILED"]).default("SUCCESS").notNull(),
  responseJson: text("responseJson"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  keyOperationIdx: uniqueIndex("idempotency_key_operation_idx").on(table.key, table.userId, table.operation),
  userIdx: index("idempotency_user_idx").on(table.userId),
  expiryIdx: index("idempotency_expiry_idx").on(table.expiresAt),
}));


export const securityEvents = mysqlTable("securityEvents", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  ipHash: varchar("ipHash", { length: 128 }),
  endpoint: varchar("endpoint", { length: 160 }),
  severity: mysqlEnum("severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM").notNull(),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("security_events_type_idx").on(table.eventType),
  createdIdx: index("security_events_created_idx").on(table.createdAt),
  userIdx: index("security_events_user_idx").on(table.userId),
}));

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  actorType: varchar("actorType", { length: 32 }).notNull(),
  actorId: varchar("actorId", { length: 128 }),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entityType", { length: 64 }),
  entityId: varchar("entityId", { length: 128 }),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  actionIdx: index("audit_logs_action_idx").on(table.action),
  createdIdx: index("audit_logs_created_idx").on(table.createdAt),
}));

export const ticketScans = mysqlTable("ticketScans", {
  id: int("id").autoincrement().primaryKey(),
  ticketId: int("ticketId").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  scannerId: varchar("scannerId", { length: 128 }),
  result: varchar("result", { length: 32 }).notNull(),
  ipHash: varchar("ipHash", { length: 128 }),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
}, (table) => ({
  ticketIdx: index("ticket_scans_ticket_idx").on(table.ticketId),
  scannedIdx: index("ticket_scans_scanned_idx").on(table.scannedAt),
}));

export const securityRateLimits = mysqlTable("securityRateLimits", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 160 }).notNull(),
  policy: varchar("policy", { length: 64 }).notNull(),
  windowStart: timestamp("windowStart").notNull(),
  count: int("count").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  windowIdx: uniqueIndex("security_rate_limits_window_idx").on(table.key, table.policy, table.windowStart),
  updatedIdx: index("security_rate_limits_updated_idx").on(table.updatedAt),
}));

export const queueEntries = mysqlTable("queueEntries", {
  id: int("id").autoincrement().primaryKey(),
  queueId: varchar("queueId", { length: 64 }).notNull().unique(),
  eventId: int("eventId").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: int("userId").references(() => users.id, { onDelete: "set null" }),
  sessionId: varchar("sessionId", { length: 128 }),
  status: mysqlEnum("status", ["WAITING", "ADMITTED", "LEFT", "EXPIRED"]).default("WAITING").notNull(),
  admissionTokenHash: varchar("admissionTokenHash", { length: 128 }),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  admittedAt: timestamp("admittedAt"),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({
  eventStatusIdx: index("queue_entries_event_status_idx").on(table.eventId, table.status),
  userEventIdx: uniqueIndex("queue_entries_user_event_idx").on(table.eventId, table.userId, table.status),
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
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
