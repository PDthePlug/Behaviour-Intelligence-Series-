CREATE TABLE `organisations` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `organisations_slug_unique` ON `organisations` (`slug`);--> statement-breakpoint
CREATE INDEX `organisations_status_idx` ON `organisations` (`status`);--> statement-breakpoint
CREATE TABLE `organisation_users` (
  `id` text PRIMARY KEY NOT NULL,
  `organisation_id` text NOT NULL,
  `email` text NOT NULL,
  `role` text DEFAULT 'viewer' NOT NULL,
  `status` text DEFAULT 'invited' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `organisation_users_org_email_unique` ON `organisation_users` (`organisation_id`,`email`);--> statement-breakpoint
CREATE INDEX `organisation_users_email_idx` ON `organisation_users` (`email`);--> statement-breakpoint
CREATE TABLE `deployments` (
  `id` text PRIMARY KEY NOT NULL,
  `organisation_id` text NOT NULL,
  `name` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `starts_at` integer,
  `ends_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `deployments_organisation_idx` ON `deployments` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `deployments_status_idx` ON `deployments` (`status`);--> statement-breakpoint
CREATE TABLE `cohorts` (
  `id` text PRIMARY KEY NOT NULL,
  `organisation_id` text NOT NULL,
  `deployment_id` text NOT NULL,
  `name` text NOT NULL,
  `external_ref` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `cohorts_organisation_idx` ON `cohorts` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `cohorts_deployment_idx` ON `cohorts` (`deployment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cohorts_deployment_name_unique` ON `cohorts` (`deployment_id`,`name`);--> statement-breakpoint
CREATE TABLE `cohort_members` (
  `id` text PRIMARY KEY NOT NULL,
  `cohort_id` text NOT NULL,
  `learner_id` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `joined_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `cohort_members_cohort_learner_unique` ON `cohort_members` (`cohort_id`,`learner_id`);--> statement-breakpoint
CREATE INDEX `cohort_members_learner_idx` ON `cohort_members` (`learner_id`);--> statement-breakpoint
CREATE INDEX `cohort_members_status_idx` ON `cohort_members` (`cohort_id`,`status`);--> statement-breakpoint
CREATE TABLE `lab_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `cohort_id` text NOT NULL,
  `cartridge_id` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `assigned_at` integer NOT NULL,
  `due_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `lab_assignments_cohort_cartridge_unique` ON `lab_assignments` (`cohort_id`,`cartridge_id`);--> statement-breakpoint
CREATE INDEX `lab_assignments_status_idx` ON `lab_assignments` (`cohort_id`,`status`);--> statement-breakpoint
ALTER TABLE `lab_component_responses` ADD `cohort_id` text;--> statement-breakpoint
ALTER TABLE `lab_component_responses` ADD `assignment_id` text;--> statement-breakpoint
CREATE INDEX `lab_component_responses_cohort_idx` ON `lab_component_responses` (`cohort_id`,`assignment_id`);--> statement-breakpoint
CREATE TABLE `facilitator_observations` (
  `id` text PRIMARY KEY NOT NULL,
  `cohort_id` text NOT NULL,
  `learner_id` text NOT NULL,
  `cartridge_id` text NOT NULL,
  `facilitator_email` text NOT NULL,
  `participation` integer,
  `attention` integer,
  `task_completion` integer,
  `willingness_to_contribute` integer,
  `reflection_depth` integer,
  `evidence_quality` integer,
  `confidence` text,
  `indicators` text DEFAULT '[]' NOT NULL,
  `notes` text,
  `observed_at` integer NOT NULL,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `facilitator_observations_cohort_idx` ON `facilitator_observations` (`cohort_id`,`cartridge_id`);--> statement-breakpoint
CREATE INDEX `facilitator_observations_learner_idx` ON `facilitator_observations` (`learner_id`,`cartridge_id`);--> statement-breakpoint
CREATE TABLE `bei_evidence` (
  `id` text PRIMARY KEY NOT NULL,
  `cohort_id` text NOT NULL,
  `learner_id` text NOT NULL,
  `cartridge_id` text NOT NULL,
  `bei_code` text NOT NULL,
  `phase` text DEFAULT 'observed' NOT NULL,
  `source_type` text NOT NULL,
  `source_id` text,
  `numeric_value` integer,
  `text_value` text,
  `evidence_quality` integer,
  `observed_at` integer NOT NULL,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `bei_evidence_cohort_idx` ON `bei_evidence` (`cohort_id`,`cartridge_id`,`bei_code`);--> statement-breakpoint
CREATE INDEX `bei_evidence_learner_idx` ON `bei_evidence` (`learner_id`,`cartridge_id`,`bei_code`);--> statement-breakpoint
CREATE TABLE `outcome_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `cohort_id` text NOT NULL,
  `cartridge_id` text,
  `snapshot_type` text NOT NULL,
  `payload` text NOT NULL,
  `generated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `outcome_snapshots_cohort_idx` ON `outcome_snapshots` (`cohort_id`,`generated_at`);--> statement-breakpoint
CREATE TABLE `generated_reports` (
  `id` text PRIMARY KEY NOT NULL,
  `cohort_id` text NOT NULL,
  `report_type` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `payload` text DEFAULT '{}' NOT NULL,
  `generated_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `generated_reports_cohort_idx` ON `generated_reports` (`cohort_id`,`report_type`);--> statement-breakpoint
CREATE TABLE `learner_consents` (
  `id` text PRIMARY KEY NOT NULL,
  `learner_id` text NOT NULL,
  `cohort_id` text,
  `consent_type` text NOT NULL,
  `granted` integer DEFAULT false NOT NULL,
  `captured_at` integer NOT NULL,
  `revoked_at` integer,
  `source` text DEFAULT 'digital' NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `learner_consents_scope_unique` ON `learner_consents` (`learner_id`,`cohort_id`,`consent_type`);--> statement-breakpoint
CREATE INDEX `learner_consents_cohort_idx` ON `learner_consents` (`cohort_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `organisation_id` text,
  `actor_type` text NOT NULL,
  `actor_ref` text,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `metadata` text DEFAULT '{}' NOT NULL,
  `created_at` integer NOT NULL
);--> statement-breakpoint
CREATE INDEX `audit_events_organisation_idx` ON `audit_events` (`organisation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);