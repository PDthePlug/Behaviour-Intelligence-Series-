CREATE TABLE `lab_component_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`learner_id` text NOT NULL,
	`cartridge_id` text NOT NULL,
	`step_id` text NOT NULL,
	`component_id` text NOT NULL,
	`payload` text NOT NULL,
	`is_complete` integer DEFAULT false NOT NULL,
	`bei_target` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_component_responses_unique` ON `lab_component_responses` (`learner_id`,`cartridge_id`,`component_id`);--> statement-breakpoint
CREATE INDEX `lab_component_responses_learner_idx` ON `lab_component_responses` (`learner_id`,`cartridge_id`);--> statement-breakpoint
CREATE INDEX `lab_component_responses_step_idx` ON `lab_component_responses` (`step_id`);--> statement-breakpoint
CREATE INDEX `lab_component_responses_updated_idx` ON `lab_component_responses` (`updated_at`);--> statement-breakpoint
CREATE TABLE `learner_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`first_name` text NOT NULL,
	`surname` text NOT NULL,
	`email` text NOT NULL,
	`passcode_hash` text NOT NULL,
	`passcode_salt` text NOT NULL,
	`country` text DEFAULT 'South Africa' NOT NULL,
	`selected_pattern` text DEFAULT 'Focus & Distraction' NOT NULL,
	`profile_style` text DEFAULT 'quiet' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learner_profiles_session_unique` ON `learner_profiles` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `learner_profiles_email_unique` ON `learner_profiles` (`email`);--> statement-breakpoint
CREATE INDEX `learner_profiles_updated_idx` ON `learner_profiles` (`updated_at`);