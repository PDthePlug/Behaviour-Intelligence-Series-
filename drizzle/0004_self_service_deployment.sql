ALTER TABLE `organisation_users` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `organisation_users` ADD `surname` text;--> statement-breakpoint
ALTER TABLE `organisation_users` ADD `passcode_hash` text;--> statement-breakpoint
ALTER TABLE `organisation_users` ADD `passcode_salt` text;--> statement-breakpoint
ALTER TABLE `organisation_users` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `lab_assignments` ADD `starts_at` integer;--> statement-breakpoint
CREATE TABLE `institutional_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `institutional_sessions_token_unique` ON `institutional_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `institutional_sessions_user_idx` ON `institutional_sessions` (`organisation_user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `organisation_user_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_by_user_id` text,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `organisation_user_invites_token_unique` ON `organisation_user_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `organisation_user_invites_org_idx` ON `organisation_user_invites` (`organisation_id`,`email`);--> statement-breakpoint
CREATE TABLE `facilitator_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_user_id` text NOT NULL,
	`cohort_id` text NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `facilitator_cohorts_unique` ON `facilitator_cohorts` (`organisation_user_id`,`cohort_id`);--> statement-breakpoint
CREATE INDEX `facilitator_cohorts_cohort_idx` ON `facilitator_cohorts` (`cohort_id`);--> statement-breakpoint
CREATE TABLE `learner_enrolment_links` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text DEFAULT 'Learner enrolment' NOT NULL,
	`max_uses` integer,
	`uses` integer DEFAULT 0 NOT NULL,
	`require_learner_consent` integer DEFAULT true NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `learner_enrolment_links_token_unique` ON `learner_enrolment_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `learner_enrolment_links_cohort_idx` ON `learner_enrolment_links` (`cohort_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `organisation_users_role_idx` ON `organisation_users` (`organisation_id`,`role`,`status`);--> statement-breakpoint
CREATE INDEX `lab_assignments_schedule_idx` ON `lab_assignments` (`cohort_id`,`starts_at`,`due_at`);