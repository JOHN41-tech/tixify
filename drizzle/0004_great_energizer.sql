CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorType` varchar(32) NOT NULL,
	`actorId` varchar(128),
	`action` varchar(80) NOT NULL,
	`entityType` varchar(64),
	`entityId` varchar(128),
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `queueEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queueId` varchar(64) NOT NULL,
	`eventId` int NOT NULL,
	`userId` int,
	`sessionId` varchar(128),
	`status` enum('WAITING','ADMITTED','LEFT','EXPIRED') NOT NULL DEFAULT 'WAITING',
	`admissionTokenHash` varchar(128),
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`admittedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `queueEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `queueEntries_queueId_unique` UNIQUE(`queueId`),
	CONSTRAINT `queue_entries_user_event_idx` UNIQUE(`eventId`,`userId`,`status`)
);
--> statement-breakpoint
CREATE TABLE `securityEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`userId` int,
	`ipHash` varchar(128),
	`endpoint` varchar(160),
	`severity` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securityRateLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(160) NOT NULL,
	`policy` varchar(64) NOT NULL,
	`windowStart` timestamp NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `securityRateLimits_id` PRIMARY KEY(`id`),
	CONSTRAINT `security_rate_limits_window_idx` UNIQUE(`key`,`policy`,`windowStart`)
);
--> statement-breakpoint
CREATE TABLE `ticketScans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`scannerId` varchar(128),
	`result` varchar(32) NOT NULL,
	`ipHash` varchar(128),
	`scannedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticketScans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tickets` MODIFY COLUMN `status` enum('VALID','USED','CANCELLED') NOT NULL DEFAULT 'VALID';--> statement-breakpoint
ALTER TABLE `tickets` ADD `ticketVersion` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `signedPayload` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `signature` varchar(128);--> statement-breakpoint
ALTER TABLE `tickets` ADD `issuedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `tickets` ADD `usedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tickets` ADD `usedBy` varchar(128);--> statement-breakpoint
ALTER TABLE `queueEntries` ADD CONSTRAINT `queueEntries_eventId_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `queueEntries` ADD CONSTRAINT `queueEntries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `securityEvents` ADD CONSTRAINT `securityEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticketScans` ADD CONSTRAINT `ticketScans_ticketId_tickets_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `auditLogs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `auditLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `queue_entries_event_status_idx` ON `queueEntries` (`eventId`,`status`);--> statement-breakpoint
CREATE INDEX `security_events_type_idx` ON `securityEvents` (`eventType`);--> statement-breakpoint
CREATE INDEX `security_events_created_idx` ON `securityEvents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `security_events_user_idx` ON `securityEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `security_rate_limits_updated_idx` ON `securityRateLimits` (`updatedAt`);--> statement-breakpoint
CREATE INDEX `ticket_scans_ticket_idx` ON `ticketScans` (`ticketId`);--> statement-breakpoint
CREATE INDEX `ticket_scans_scanned_idx` ON `ticketScans` (`scannedAt`);