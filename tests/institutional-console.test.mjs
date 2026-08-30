import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("uses one shared outcome service for dashboard and executive reports", () => {
  const dashboard = source("app/api/institutional/dashboard/route.ts");
  const reports = source("app/api/institutional/reports/route.ts");
  assert.match(dashboard, /buildCohortOutcome/);
  assert.match(reports, /buildCohortOutcome/);
  assert.match(reports, /buildExecutiveReport/);
});

test("freezes each executive report with an outcome snapshot and audit event", () => {
  const reports = source("app/api/institutional/reports/route.ts");
  assert.match(reports, /generatedReports/);
  assert.match(reports, /outcomeSnapshots/);
  assert.match(reports, /auditEvents/);
  assert.match(reports, /report\.generate/);
  assert.match(reports, /snapshotType: "executive_outcome"/);
});

test("keeps executive reporting descriptive and privacy bounded", () => {
  const report = source("lib/executive-report.ts");
  assert.match(report, /status: "descriptive"/);
  assert.match(report, /does not establish psychometric validity, clinical diagnosis, or causal programme impact/);
  assert.match(report, /Private learner reflection words are excluded/);
  assert.doesNotMatch(report, /learnerReflections/);
  assert.doesNotMatch(report, /labComponentResponses/);
});

test("institutional console never requests or renders private reflection payloads", () => {
  const consoleSource = source("components/bis/InstitutionalConsole.tsx");
  assert.match(consoleSource, /\/api\/institutional\/dashboard/);
  assert.match(consoleSource, /\/api\/institutional\/reports/);
  assert.match(consoleSource, /Private learner reflection words are excluded/);
  assert.doesNotMatch(consoleSource, /learnerReflections/);
  assert.doesNotMatch(consoleSource, /payload\.answers/);
});

test("institutional console keeps the admin key session scoped", () => {
  const consoleSource = source("components/bis/InstitutionalConsole.tsx");
  assert.match(consoleSource, /sessionStorage\.getItem\("bis-institutional-admin-key"\)/);
  assert.match(consoleSource, /sessionStorage\.setItem\("bis-institutional-admin-key"/);
  assert.doesNotMatch(consoleSource, /localStorage/);
});
