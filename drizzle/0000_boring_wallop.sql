CREATE TABLE `letters` (
	`id` text PRIMARY KEY NOT NULL,
	`mailbox_id` text NOT NULL,
	`title` text NOT NULL,
	`recipient` text NOT NULL,
	`sender` text NOT NULL,
	`note` text NOT NULL,
	`date` text NOT NULL,
	`color` text NOT NULL,
	`media` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`share_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_owner_id_unique` ON `mailboxes` (`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_share_key_unique` ON `mailboxes` (`share_key`);