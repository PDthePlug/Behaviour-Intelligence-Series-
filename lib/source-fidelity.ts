import type { ChecklistProps, DailyEvidenceTrackerProps, LabCartridge } from "@/lib/habit-lab";

const HABIT_ID = "habit-lab-2026";
const DECISION_ID = "decision-lab-2026";

const habitRiskItems = ["Health", "Money", "Relationships", "School", "Work", "Mental wellbeing"];
const decisionRiskItems = ["Health", "Money", "Relationships", "School/Work", "My future", "People who depend on me"];
const decisionProfileSummaryIds = new Set([
  "comp_profile_pattern",
  "comp_profile_perceived",
  "comp_profile_hidden",
  "comp_profile_emotion",
  "comp_profile_cost",
  "comp_profile_equation",
  "comp_profile_confidence",
  "comp_profile_quality",
  "comp_profile_next",
  "comp_profile_onesentence",
]);

function cloneLab(lab: LabCartridge): LabCartridge {
  return JSON.parse(JSON.stringify(lab)) as LabCartridge;
}

/**
 * The published workbook is the measurement authority.
 *
 * The first digital cartridges pre-dated the evidence engine and represented
 * BEI-05/06 with generic Likert controls. This overlay prevents those UI
 * conveniences from silently redefining the workbook instruments while the
 * cartridge manufacturing pipeline is being upgraded.
 */
export function applyWorkbookSourceFidelity(input: LabCartridge): LabCartridge {
  const lab = cloneLab(input);
  if (lab.cartridgeId !== HABIT_ID && lab.cartridgeId !== DECISION_ID) return lab;

  const isDecision = lab.cartridgeId === DECISION_ID;
  const riskItems = isDecision ? decisionRiskItems : habitRiskItems;

  for (const step of lab.timeline.steps) {
    for (const component of step.components) {
      if (component.id === "comp_contract_risk") {
        component.type = "CheckboxInventory";
        component.beiTarget = "BEI-05";
        component.props = {
          question: isDecision
            ? "BEI-05: Decision Risk Index\n\nMy decisions most affect:"
            : "BEI-05: Behaviour Risk Index\n\nMy habit affects:",
          items: riskItems,
        } satisfies ChecklistProps;
      }

      if (component.id === "comp_exp_matrix") {
        component.type = "DailyEvidenceTracker";
        component.beiTarget = "BEI-06";
        component.props = {
          question: isDecision
            ? "BEI-06: Experiment Adherence Rate\n\nEach day, record one decision you made. Mark whether you applied your new decision rule."
            : "BEI-06: Experiment Adherence Rate\n\nEach day, mark whether you did your new routine. Write what helped or got in the way.",
          days: 7,
          actionLabel: isDecision ? "Decision" : undefined,
          doneLabel: isDecision ? "Applied rule" : "Done",
          notDoneLabel: isDecision ? "Did not apply rule" : "Not done",
          notesLabel: "Notes",
        } satisfies DailyEvidenceTrackerProps;
      }

      if (isDecision && decisionProfileSummaryIds.has(component.id)) {
        component.beiTarget = "BEI-10";
      }
    }
  }

  for (const indicator of lab.beiSchema) {
    if (indicator.code === "BEI-05") {
      indicator.type = "set";
      indicator.range = [];
    }
    if (indicator.code === "BEI-06") {
      indicator.type = "count";
      indicator.range = [0, 7];
    }
  }

  return lab;
}
