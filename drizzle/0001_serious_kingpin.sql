CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`type` enum('expense','income') NOT NULL DEFAULT 'expense',
	`color` varchar(16) NOT NULL DEFAULT '#7A9384',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `extraction_runs` (
	`id` varchar(36) NOT NULL,
	`receiptId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`model` varchar(100) NOT NULL,
	`status` enum('processing','success','failed') NOT NULL DEFAULT 'processing',
	`confidence` decimal(5,4),
	`resultJson` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `extraction_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`status` enum('uploaded','processing','needs_review','approved','failed') NOT NULL DEFAULT 'uploaded',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`quantity` decimal(12,3),
	`unitPrice` decimal(14,2),
	`total` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transaction_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receiptId` varchar(36),
	`categoryId` int,
	`type` enum('expense','income') NOT NULL DEFAULT 'expense',
	`merchant` varchar(255),
	`occurredAt` timestamp NOT NULL,
	`total` decimal(14,2) NOT NULL,
	`subtotal` decimal(14,2),
	`tax` decimal(14,2),
	`discount` decimal(14,2),
	`currency` varchar(3) NOT NULL DEFAULT 'IDR',
	`paymentMethod` enum('cash','debit','credit','ewallet','bank_transfer','other') NOT NULL DEFAULT 'other',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `extraction_runs` ADD CONSTRAINT `extraction_runs_receiptId_receipts_id_fk` FOREIGN KEY (`receiptId`) REFERENCES `receipts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `extraction_runs` ADD CONSTRAINT `extraction_runs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `receipts` ADD CONSTRAINT `receipts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_items` ADD CONSTRAINT `transaction_items_transactionId_transactions_id_fk` FOREIGN KEY (`transactionId`) REFERENCES `transactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_receiptId_receipts_id_fk` FOREIGN KEY (`receiptId`) REFERENCES `receipts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `categories_user_type_idx` ON `categories` (`userId`,`type`);--> statement-breakpoint
CREATE INDEX `extraction_runs_receipt_idx` ON `extraction_runs` (`receiptId`);--> statement-breakpoint
CREATE INDEX `extraction_runs_user_status_idx` ON `extraction_runs` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `receipts_user_status_idx` ON `receipts` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `receipts_user_created_idx` ON `receipts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `transaction_items_transaction_idx` ON `transaction_items` (`transactionId`);--> statement-breakpoint
CREATE INDEX `transactions_user_occurred_idx` ON `transactions` (`userId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `transactions_user_category_idx` ON `transactions` (`userId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `transactions_receipt_idx` ON `transactions` (`receiptId`);