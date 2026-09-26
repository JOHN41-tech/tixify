ALTER TABLE `idempotencyKeys` ADD `status` enum('PROCESSING','SUCCESS','FAILED') DEFAULT 'SUCCESS' NOT NULL;--> statement-breakpoint
ALTER TABLE `idempotencyKeys` ADD `expiresAt` timestamp;--> statement-breakpoint
CREATE INDEX `idempotency_expiry_idx` ON `idempotencyKeys` (`expiresAt`);