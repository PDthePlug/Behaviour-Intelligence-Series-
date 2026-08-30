CREATE TABLE `learner_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`lab_slug` text NOT NULL,
	`completed_steps` integer DEFAULT 0 NOT NULL,
	`last_step` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learner_progress_session_lab_unique` ON `learner_progress` (`session_id`,`lab_slug`);--> statement-breakpoint
CREATE INDEX `learner_progress_updated_idx` ON `learner_progress` (`updated_at`);--> statement-breakpoint
CREATE TABLE `learner_reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`lab_slug` text NOT NULL,
	`step_key` text NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`is_private` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learner_reflections_session_idx` ON `learner_reflections` (`session_id`,`lab_slug`);--> statement-breakpoint
CREATE INDEX `learner_reflections_created_idx` ON `learner_reflections` (`created_at`);--> statement-breakpoint
CREATE TABLE `partnership_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` text NOT NULL,
	`audience` text NOT NULL,
	`cohort_size` integer NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `partnership_inquiries_created_idx` ON `partnership_inquiries` (`created_at`);