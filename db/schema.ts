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
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("lab_component_responses_unique").on(table.learnerId, table.cartridgeId, table.componentId),
    index("lab_component_responses_learner_idx").on(table.learnerId, table.cartridgeId),
    index("lab_component_responses_step_idx").on(table.stepId),
    index("lab_component_responses_updated_idx").on(table.updatedAt),
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
