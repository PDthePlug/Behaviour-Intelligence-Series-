import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("defines the institutional domain needed for cohort evidence", () => {
  const schema = source("db/schema.ts");
  for (const table of [
    "organisations",
    "organisation_users",
    "deployments",
    "cohorts",
    "cohort_members",
    "lab_assignments",
    "facilitator_observations",
    "bei_evidence",
    "outcome_snapshots",
    "generated_reports",
    "learner_consents",
    "audit_events",
  ]) {
    assert.match(schema, new RegExp(`\\"${table}\\"`), `schema must define ${table}`);
  }
  assert.match(schema, /cohortId: text\("cohort_id"\)/);
  assert.match(schema, /assignmentId: text\("assignment_id"\)/);
});

test("links learner interactions to one unambiguous active institutional assignment", () => {
  const route = source("app/api/lab/route.ts");
  assert.match(route, /institutionalContextForLearner/);
  assert.match(route, /matches\.length !== 1/);
  assert.match(route, /cohortId: institutionalContext\.cohortId/);
  assert.match(route, /assignmentId: institutionalContext\.assignmentId/);
});

test("derives institutional completion from assigned cartridge structure instead of a magic denominator", () => {
  const dashboard = source("app/api/institutional/dashboard/route.ts");
  assert.match(dashboard, /labComponents\(lab\)\.length/);
  assert.match(dashboard, /expectedInteractions/);
  assert.doesNotMatch(dashboard, /\*\s*55/);
  assert.doesNotMatch(dashboard, /payload:/, "institutional dashboard must not select or emit learner response payloads");
});

test("keeps the legacy platform dashboard as telemetry rather than cohort evidence", () => {
  const dashboard = source("app/api/dashboard/route.ts");
  assert.match(dashboard, /platform telemetry, not an institutional cohort report/);
  assert.doesNotMatch(dashboard, /\*\s*55/);
});

test("requires a fail-closed institutional admin secret", () => {
  const auth = source("lib/institutional-auth.ts");
  assert.match(auth, /BIS_INSTITUTIONAL_ADMIN_KEY/);
  assert.match(auth, /status: 503/);
  assert.match(auth, /status: 401/);
  assert.match(auth, /constantTimeEqual/);
});

test("public positioning does not present illustrative metrics as live evidence", () => {
  const homepage = source("app/page.tsx");
  assert.match(homepage, /Illustrative cohort/);
  assert.match(homepage, /Illustrative interface — not live outcome data/);
  assert.match(homepage, /Habit Lab™ and Decision Lab™ are currently available as digital cartridges/);
  assert.doesNotMatch(homepage, />182</);
  assert.doesNotMatch(homepage, />76%</);
});
