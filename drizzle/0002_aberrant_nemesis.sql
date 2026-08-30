ALTER TABLE `learner_profiles` ADD `auth_provider` text DEFAULT 'passcode' NOT NULL;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `google_subject` text;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `avatar_url` text;--> statement-breakpoint
CREATE UNIQUE INDEX `learner_profiles_google_subject_unique` ON `learner_profiles` (`google_subject`);