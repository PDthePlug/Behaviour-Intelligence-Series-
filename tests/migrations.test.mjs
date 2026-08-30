import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrations = [
  "0000_fixed_nico_minoru.sql",
  "0001_bright_black_tarantula.sql",
  "0002_aberrant_nemesis.sql",
  "0003_institutional_spine.sql",
  "0004_self_service_deployment.sql",
];

function migration(name) {
  return readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

function apply(db, sql) {
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) db.exec(trimmed);
  }
}

test("applies the complete BIS D1 migration chain to an empty SQLite database", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of migrations) apply(db, migration(name));

    const tables = new Set(
      db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name),
    );
    for (const table of [
      "learner_profiles",
      "lab_component_responses",
      "organisations",
      "organisation_users",
      "institutional_sessions",
      "organisation_user_invites",
      "deployments",
      "cohorts",
      "facilitator_cohorts",
      "cohort_members",
      "learner_enrolment_links",
      "lab_assignments",
      "facilitator_observations",
      "bei_evidence",
      "outcome_snapshots",
      "generated_reports",
      "learner_consents",
      "audit_events",
    ]) {
      assert.ok(tables.has(table), `migration chain must create ${table}`);
    }

    const responseColumns = new Set(db.prepare("pragma table_info('lab_component_responses')").all().map((row) => row.name));
    assert.ok(responseColumns.has("cohort_id"));
    assert.ok(responseColumns.has("assignment_id"));

    const organisationUserColumns = new Set(db.prepare("pragma table_info('organisation_users')").all().map((row) => row.name));
    for (const column of ["first_name", "surname", "passcode_hash", "passcode_salt", "last_login_at"]) assert.ok(organisationUserColumns.has(column));

    const assignmentColumns = new Set(db.prepare("pragma table_info('lab_assignments')").all().map((row) => row.name));
    assert.ok(assignmentColumns.has("starts_at"));
  } finally {
    db.close();
  }
});
