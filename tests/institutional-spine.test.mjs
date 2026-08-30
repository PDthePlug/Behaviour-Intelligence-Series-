import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("defines the institutional domain needed for cohort evidence and self-service deployment", () => {
  const schema = source("db/schema.ts");
  for (const table of [
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
    assert.match(schema, new RegExp(`\\"${table}\\"`), `schema must define ${table}`);
  }
  assert.match(schema, /startsAt: integer\("starts_at"\)/);
  assert.match(schema, /passcodeHash: text\("passcode_hash"\)/);
});

test("links learner interactions to one unambiguous live institutional assignment", () => {
  const route = source("app/api/lab/route.ts");
  assert.match(route, /institutionalContextForLearner/);
  assert.match(route, /match\.status !== "active" && match\.status !== "scheduled"/);
  assert.match(route, /match\.startsAt && match\.startsAt > now/);
  assert.match(route, /match\.dueAt && match\.dueAt < now/);
  assert.match(route, /live\.length !== 1/);
  assert.match(route, /cohortId: institutionalContext\.cohortId/);
  assert.match(route, /assignmentId: institutionalContext\.assignmentId/);
});

test("derives institutional completion from assigned cartridge structure instead of a magic denominator", () => {
  const service = source("lib/institutional-outcomes.ts");
  const dashboard = source("app/api/institutional/dashboard/route.ts");
  assert.match(service, /labComponents\(lab\)/);
  assert.match(service, /componentCount = components\.length/);
  assert.match(service, /expectedInteractions = componentCount \* activeLearners/);
  assert.doesNotMatch(service, /\*\s*55/);
  assert.doesNotMatch(service, /payload:/, "institutional outcome service must not select learner response payloads");
  assert.match(dashboard, /buildCohortOutcome\(cohortId\)/);
  assert.match(dashboard, /requireInstitutionalAccess\(request, "outcomes:read", cohortId\)/);
});

test("keeps the legacy platform dashboard as telemetry rather than cohort evidence", () => {
  const dashboard = source("app/api/dashboard/route.ts");
  assert.match(dashboard, /platform telemetry, not an institutional cohort report/);
  assert.doesNotMatch(dashboard, /\*\s*55/);
});

test("retains a fail-closed break-glass control plane while adding tenant sessions", () => {
  const auth = source("lib/institutional-auth.ts");
  const access = source("lib/institutional-access.ts");
  assert.match(auth, /BIS_INSTITUTIONAL_ADMIN_KEY/);
  assert.match(auth, /status: 503/);
  assert.match(auth, /status: 401/);
  assert.match(auth, /constantTimeEqual/);
  assert.match(access, /bis_institutional_session/);
  assert.match(access, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(access, /facilitatorCohorts/);
  assert.match(access, /That cohort belongs to another organisation/);
});

test("public positioning does not present illustrative metrics as live evidence", () => {
  const homepage = source("app/page.tsx");
  assert.match(homepage, /Illustrative cohort/);
  assert.match(homepage, /Illustrative interface — not live outcome data/);
  assert.match(homepage, /Habit Lab™ and Decision Lab™ are currently available as digital cartridges/);
  assert.doesNotMatch(homepage, />182</);
  assert.doesNotMatch(homepage, />76%</);
});
