import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("restores workbook-authoritative BEI-05 and BEI-06 instruments", () => {
  const fidelity = source("lib/source-fidelity.ts");
  assert.match(fidelity, /component\.type = "CheckboxInventory"/);
  assert.match(fidelity, /component\.type = "DailyEvidenceTracker"/);
  assert.match(fidelity, /habitRiskItems = \["Health", "Money", "Relationships", "School", "Work", "Mental wellbeing"\]/);
  assert.match(fidelity, /decisionRiskItems = \["Health", "Money", "Relationships", "School\/Work", "My future", "People who depend on me"\]/);
  assert.match(fidelity, /days: 7/);
  assert.match(fidelity, /indicator\.type = "set"/);
  assert.match(fidelity, /indicator\.type = "count"/);
  assert.match(fidelity, /indicator\.range = \[0, 7\]/);
});

test("does not invent an average score for workbook Likert evidence", () => {
  const renderer = source("components/bis/LabComponents.tsx");
  assert.doesNotMatch(renderer, /averageScore/);
  assert.match(renderer, /Save risk inventory/);
  assert.match(renderer, /BEI-06: Days Completed:/);
  assert.match(renderer, /Consecutive Days:/);
});

test("projects governed evidence while withholding private learner writing", () => {
  const engine = source("lib/evidence-engine.ts");
  assert.match(engine, /Private learner writing is never/);
  assert.match(engine, /component\.type === "PrivateReflection"/);
  assert.match(engine, /numericValue: 1, textValue: null/);
  assert.match(engine, /selected/);
  assert.match(engine, /daysCompleted/);
  assert.doesNotMatch(engine, /record\?\.answers.*textValue/);
});

test("synchronizes evidence on learner saves and can rebuild existing cohort evidence", () => {
  const labRoute = source("app/api/lab/route.ts");
  const rebuild = source("app/api/institutional/evidence/rebuild/route.ts");
  assert.match(labRoute, /synchronizeComponentEvidence/);
  assert.match(labRoute, /evidenceProjected/);
  assert.match(rebuild, /institutionalAdminFailure/);
  assert.match(rebuild, /projectComponentEvidence/);
  assert.match(rebuild, /evidence\.rebuild/);
  assert.match(rebuild, /Private learner writing is not copied/);
});

test("reports descriptive paired shifts, source adherence and risk categories", () => {
  const service = source("lib/institutional-outcomes.ts");
  const aggregation = source("lib/outcome-aggregation.ts");
  assert.match(service, /pairedShift\(labEvidence, "BEI-01", "BEI-07"\)/);
  assert.match(service, /pairedShift\(labEvidence, "BEI-04", "BEI-08"\)/);
  assert.match(service, /adherenceSummary\(labEvidence, 7\)/);
  assert.match(service, /riskDistribution\(labEvidence\)/);
  assert.match(service, /measurementStatus: "descriptive"/);
  assert.match(service, /MIN_OUTCOME_AGGREGATE_SIZE = 5/);
  assert.match(aggregation, /fullAdherenceLearners/);
  assert.doesNotMatch(service, /psychometric validation[^\n]*true/i);
});
