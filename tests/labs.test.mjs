import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const habitLab = JSON.parse(readFileSync(new URL("../data/habit-lab.json", import.meta.url), "utf8"));
const decisionLab = JSON.parse(readFileSync(new URL("../data/decision-lab.json", import.meta.url), "utf8"));

function validateCartridge(lab) {
  const stepIds = lab.timeline.steps.map((step) => step.id);
  const components = lab.timeline.steps.flatMap((step) => step.components);
  const componentIds = components.map((component) => component.id);
  const allowedTypes = new Set(["StoryNarrative", "PrivateReflection", "LikertMatrix", "MindfulBreath"]);

  assert.equal(new Set(stepIds).size, stepIds.length, "step IDs must be unique");
  assert.equal(new Set(componentIds).size, componentIds.length, "component IDs must be unique inside a cartridge");
  assert.ok(components.every((component) => allowedTypes.has(component.type)), "every interaction must use a supported renderer");

  for (const [index, step] of lab.timeline.steps.entries()) {
    for (const prerequisite of step.prerequisites ?? []) {
      assert.ok(stepIds.slice(0, index).includes(prerequisite), `${step.id} must only depend on an earlier milestone`);
    }
  }

  return components;
}

test("keeps Habit and Decision Lab as complete independent cartridges", () => {
  assert.equal(habitLab.timeline.steps.length, 11);
  assert.equal(validateCartridge(habitLab).length, 55);

  const decisionComponents = validateCartridge(decisionLab);
  assert.equal(decisionLab.cartridgeId, "decision-lab-2026");
  assert.equal(decisionLab.version, "3.0.1");
  assert.equal(decisionLab.timeline.steps.length, 11);
  assert.equal(decisionComponents.length, 84);
  assert.equal(decisionLab.beiSchema.length, 10);
});

test("preserves the Decision workbook transformation sequence", () => {
  assert.deepEqual(decisionLab.timeline.steps.map((step) => step.title), [
    "Decision Baseline Diagnostic (Pre-Workshop)",
    "Investigation 1: The Hook",
    "Investigation 2: The Prediction",
    "Investigation 3: The Revelation",
    "Investigation 4: Decision Mapping",
    "Investigation 5: Decision Equation",
    "Investigation 6: Decision Contract",
    "Investigation 7: 7-Day Experiment",
    "Investigation 8: Evidence Review",
    "Investigation 9: Behaviour Profile",
    "Decision Transformation Certificate",
  ]);

  const sourceText = decisionLab.timeline.steps
    .flatMap((step) => [step.title, ...step.components.map((component) => component.props.markdown ?? component.props.prompt ?? component.props.question ?? "")])
    .join("\n");

  for (const marker of ["Lethabo", "third option", "Decision Equation", "Decision Contract", "7-Day", "BEI-10", "DECISION TRANSFORMATION CERTIFICATE"]) {
    assert.match(sourceText, new RegExp(marker, "i"));
  }
});

test("routes saved work through the selected cartridge boundary", () => {
  const routeSource = readFileSync(new URL("../app/api/lab/route.ts", import.meta.url), "utf8");
  assert.match(routeSource, /body\.cartridgeId/);
  assert.match(routeSource, /eq\(labComponentResponses\.cartridgeId, lab\.cartridgeId\)/);
  assert.match(routeSource, /cartridgeId: lab\.cartridgeId/);
});
