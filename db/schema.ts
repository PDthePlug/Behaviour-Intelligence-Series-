import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const learnerReflections = sqliteTable(
  "learner_reflections",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    labSlug: text("lab_slug").notNull(),
    stepKey: text("step_key").notNull(),
    prompt: text("prompt").notNull(),
    response: text("response").notNull(),
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("learner_reflections_session_idx").on(table.sessionId, table.labSlug),
    index("learner_reflections_created_idx").on(table.createdAt),
  ],
);

export const learnerProgress = sqliteTable(
  "learner_progress",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    labSlug: text("lab_slug").notNull(),
    completedSteps: integer("completed_steps").notNull().default(0),
    lastStep: text("last_step"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("learner_progress_session_lab_unique").on(table.sessionId, table.labSlug),
    index("learner_progress_updated_idx").on(table.updatedAt),
  ],
);

export const learnerProfiles = sqliteTable(
  "learner_profiles",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    firstName: text("first_name").notNull(),
    surname: text("surname").notNull(),
    email: text("email").notNull(),
    passcodeHash: text("passcode_hash").notNull(),
    passcodeSalt: text("passcode_salt").notNull(),
    authProvider: text("auth_provider").notNull().default("passcode"),
    googleSubject: text("google_subject"),
    avatarUrl: text("avatar_url"),
    country: text("country").notNull().default("South Africa"),
    selectedPattern: text("selected_pattern").notNull().default("Focus & Distraction"),
    profileStyle: text("profile_style").notNull().default("quiet"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("learner_profiles_session_unique").on(table.sessionId),
    uniqueIndex("learner_profiles_email_unique").on(table.email),
    uniqueIndex("learner_profiles_google_subject_unique").on(table.googleSubject),
    index("learner_profiles_updated_idx").on(table.updatedAt),
  ],
);

export const organisations = sqliteTable(
  "organisations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("organisations_slug_unique").on(table.slug),
    index("organisations_status_idx").on(table.status),
  ],
);

export const organisationUsers = sqliteTable(
  "organisation_users",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    email: text("email").notNull(),
    firstName: text("first_name"),
    surname: text("surname"),
    role: text("role").notNull().default("viewer"),
    status: text("status").notNull().default("invited"),
    passcodeHash: text("passcode_hash"),
    passcodeSalt: text("passcode_salt"),
    lastLoginAt: integer("last_login_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("organisation_users_org_email_unique").on(table.organisationId, table.email),
    index("organisation_users_email_idx").on(table.email),
    index("organisation_users_role_idx").on(table.organisationId, table.role, table.status),
  ],
);

export const institutionalSessions = sqliteTable(
  "institutional_sessions",
  {
    id: text("id").primaryKey(),
    organisationUserId: text("organisation_user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("institutional_sessions_token_unique").on(table.tokenHash),
    index("institutional_sessions_user_idx").on(table.organisationUserId, table.expiresAt),
  ],
);

export const organisationUserInvites = sqliteTable(
  "organisation_user_invites",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    acceptedAt: integer("accepted_at"),
    createdByUserId: text("created_by_user_id"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("organisation_user_invites_token_unique").on(table.tokenHash),
    index("organisation_user_invites_org_idx").on(table.organisationId, table.email),
  ],
);

export const deployments = sqliteTable(
  "deployments",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    startsAt: integer("starts_at"),
    endsAt: integer("ends_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("deployments_organisation_idx").on(table.organisationId),
    index("deployments_status_idx").on(table.status),
  ],
);

export const cohorts = sqliteTable(
  "cohorts",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id").notNull(),
    deploymentId: text("deployment_id").notNull(),
    name: text("name").notNull(),
    externalRef: text("external_ref"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("cohorts_organisation_idx").on(table.organisationId),
    index("cohorts_deployment_idx").on(table.deploymentId),
    uniqueIndex("cohorts_deployment_name_unique").on(table.deploymentId, table.name),
  ],
);

export const facilitatorCohorts = sqliteTable(
  "facilitator_cohorts",
  {
    id: text("id").primaryKey(),
    organisationUserId: text("organisation_user_id").notNull(),
    cohortId: text("cohort_id").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("facilitator_cohorts_unique").on(table.organisationUserId, table.cohortId),
    index("facilitator_cohorts_cohort_idx").on(table.cohortId),
  ],
);

export const cohortMembers = sqliteTable(
  "cohort_members",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    learnerId: text("learner_id").notNull(),
    status: text("status").notNull().default("active"),
    joinedAt: integer("joined_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("cohort_members_cohort_learner_unique").on(table.cohortId, table.learnerId),
    index("cohort_members_learner_idx").on(table.learnerId),
    index("cohort_members_status_idx").on(table.cohortId, table.status),
  ],
);

export const learnerEnrolmentLinks = sqliteTable(
  "learner_enrolment_links",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    label: text("label").notNull().default("Learner enrolment"),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    requireLearnerConsent: integer("require_learner_consent", { mode: "boolean" }).notNull().default(true),
    expiresAt: integer("expires_at"),
    revokedAt: integer("revoked_at"),
    createdByUserId: text("created_by_user_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("learner_enrolment_links_token_unique").on(table.tokenHash),
    index("learner_enrolment_links_cohort_idx").on(table.cohortId, table.expiresAt),
  ],
);

export const labAssignments = sqliteTable(
  "lab_assignments",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    cartridgeId: text("cartridge_id").notNull(),
    status: text("status").notNull().default("active"),
    assignedAt: integer("assigned_at").notNull(),
    startsAt: integer("starts_at"),
    dueAt: integer("due_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("lab_assignments_cohort_cartridge_unique").on(table.cohortId, table.cartridgeId),
    index("lab_assignments_status_idx").on(table.cohortId, table.status),
    index("lab_assignments_schedule_idx").on(table.cohortId, table.startsAt, table.dueAt),
  ],
);

export const labComponentResponses = sqliteTable(
  "lab_component_responses",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    cartridgeId: text("cartridge_id").notNull(),
    stepId: text("step_id").notNull(),
    componentId: text("component_id").notNull(),
    payload: text("payload").notNull(),
    isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),
    beiTarget: text("bei_target"),
    cohortId: text("cohort_id"),
    assignmentId: text("assignment_id"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("lab_component_responses_unique").on(table.learnerId, table.cartridgeId, table.componentId),
    index("lab_component_responses_learner_idx").on(table.learnerId, table.cartridgeId),
    index("lab_component_responses_step_idx").on(table.stepId),
    index("lab_component_responses_cohort_idx").on(table.cohortId, table.assignmentId),
    index("lab_component_responses_updated_idx").on(table.updatedAt),
  ],
);

export const facilitatorObservations = sqliteTable(
  "facilitator_observations",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    learnerId: text("learner_id").notNull(),
    cartridgeId: text("cartridge_id").notNull(),
    facilitatorEmail: text("facilitator_email").notNull(),
    participation: integer("participation"),
    attention: integer("attention"),
    taskCompletion: integer("task_completion"),
    willingnessToContribute: integer("willingness_to_contribute"),
    reflectionDepth: integer("reflection_depth"),
    evidenceQuality: integer("evidence_quality"),
    confidence: text("confidence"),
    indicators: text("indicators").notNull().default("[]"),
    notes: text("notes"),
    observedAt: integer("observed_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("facilitator_observations_cohort_idx").on(table.cohortId, table.cartridgeId),
    index("facilitator_observations_learner_idx").on(table.learnerId, table.cartridgeId),
  ],
);

export const beiEvidence = sqliteTable(
  "bei_evidence",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    learnerId: text("learner_id").notNull(),
    cartridgeId: text("cartridge_id").notNull(),
    beiCode: text("bei_code").notNull(),
    phase: text("phase").notNull().default("observed"),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    numericValue: integer("numeric_value"),
    textValue: text("text_value"),
    evidenceQuality: integer("evidence_quality"),
    observedAt: integer("observed_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("bei_evidence_cohort_idx").on(table.cohortId, table.cartridgeId, table.beiCode),
    index("bei_evidence_learner_idx").on(table.learnerId, table.cartridgeId, table.beiCode),
  ],
);

export const outcomeSnapshots = sqliteTable(
  "outcome_snapshots",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    cartridgeId: text("cartridge_id"),
    snapshotType: text("snapshot_type").notNull(),
    payload: text("payload").notNull(),
    generatedAt: integer("generated_at").notNull(),
  },
  (table) => [index("outcome_snapshots_cohort_idx").on(table.cohortId, table.generatedAt)],
);

export const generatedReports = sqliteTable(
  "generated_reports",
  {
    id: text("id").primaryKey(),
    cohortId: text("cohort_id").notNull(),
    reportType: text("report_type").notNull(),
    status: text("status").notNull().default("draft"),
    payload: text("payload").notNull().default("{}"),
    generatedAt: integer("generated_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("generated_reports_cohort_idx").on(table.cohortId, table.reportType)],
);

export const learnerConsents = sqliteTable(
  "learner_consents",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    cohortId: text("cohort_id"),
    consentType: text("consent_type").notNull(),
    granted: integer("granted", { mode: "boolean" }).notNull().default(false),
    capturedAt: integer("captured_at").notNull(),
    revokedAt: integer("revoked_at"),
    source: text("source").notNull().default("digital"),
  },
  (table) => [
    uniqueIndex("learner_consents_scope_unique").on(table.learnerId, table.cohortId, table.consentType),
    index("learner_consents_cohort_idx").on(table.cohortId),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    organisationId: text("organisation_id"),
    actorType: text("actor_type").notNull(),
    actorRef: text("actor_ref"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("audit_events_organisation_idx").on(table.organisationId, table.createdAt),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const partnershipInquiries = sqliteTable(
  "partnership_inquiries",
  {
    id: text("id").primaryKey(),
    organisation: text("organisation").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    audience: text("audience").notNull(),
    cohortSize: integer("cohort_size").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("partnership_inquiries_created_idx").on(table.createdAt)],
);
