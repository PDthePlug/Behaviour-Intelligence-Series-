import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { beiEvidence } from "@/db/schema";
import type {
  ChecklistProps,
  DailyEvidenceTrackerProps,
  LabCartridge,
  LabComponent,
  LikertProps,
  StoryNarrativeProps,
} from "@/lib/habit-lab";

type JsonRecord = Record<string, unknown>;

type TrackerDay = {
  date?: unknown;
  action?: unknown;
  done?: unknown;
  notes?: unknown;
};

export type ProjectedEvidence = {
  beiCode: string;
  phase: "pre" | "calibration" | "risk" | "experiment" | "post" | "profile" | "observed";
  sourceType: "component";
  sourceId: string;
  numericValue: number | null;
  textValue: string | null;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function phaseForCode(code: string): ProjectedEvidence["phase"] {
  if (code === "BEI-01" || code === "BEI-02" || code === "BEI-04") return "pre";
  if (code === "BEI-03") return "calibration";
  if (code === "BEI-05") return "risk";
  if (code === "BEI-06") return "experiment";
  if (code === "BEI-07" || code === "BEI-08") return "post";
  if (code === "BEI-09" || code === "BEI-10") return "profile";
  return "observed";
}

function numericWithinDeclaredRange(lab: LabCartridge, beiCode: string, value: number) {
  const indicator = lab.beiSchema.find((candidate) => candidate.code === beiCode);
  if (!indicator || indicator.type === "set") return true;
  if (indicator.range.length === 0) return true;
  const min = Math.min(...indicator.range);
  const max = Math.max(...indicator.range);
  return Number.isFinite(value) && value >= min && value <= max;
}

function longestDoneStreak(days: TrackerDay[]) {
  let longest = 0;
  let current = 0;
  for (const day of days) {
    if (day.done === true) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * Projects only governed evidence fields. Private learner writing is never
 * copied into the institutional evidence store.
 */
export function projectComponentEvidence(
  lab: LabCartridge,
  component: LabComponent,
  payload: unknown,
  isComplete: boolean,
): ProjectedEvidence | null {
  const beiCode = component.beiTarget;
  if (!beiCode || !isComplete) return null;
  if (!lab.beiSchema.some((indicator) => indicator.code === beiCode)) return null;

  const base = {
    beiCode,
    phase: phaseForCode(beiCode),
    sourceType: "component" as const,
    sourceId: component.id,
  };
  const record = asRecord(payload);

  if (component.type === "StoryNarrative") {
    const props = component.props as StoryNarrativeProps;
    const selectedIndex = typeof record?.selectedIndex === "number" ? record.selectedIndex : -1;
    const pivotScore = props.pivots?.[selectedIndex]?.beiScore;
    const submittedScore = typeof record?.beiScore === "number" ? record.beiScore : undefined;
    const score = typeof pivotScore === "number" ? pivotScore : submittedScore;
    if (typeof score !== "number" || !numericWithinDeclaredRange(lab, beiCode, score)) return null;
    return { ...base, numericValue: score, textValue: null };
  }

  if (component.type === "LikertMatrix") {
    const props = component.props as LikertProps;
    const answers = asRecord(record?.answers);
    if (!answers) return null;
    const itemScores = props.items.map((_, index) => answers[String(index)]).filter((value): value is number => typeof value === "number");
    if (itemScores.length !== props.items.length || itemScores.some((value) => value < 1 || value > props.labels.length)) return null;
    return {
      ...base,
      numericValue: null,
      textValue: JSON.stringify({ itemScores }),
    };
  }

  if (component.type === "CheckboxInventory") {
    const props = component.props as ChecklistProps;
    const raw = Array.isArray(record?.selectedItems) ? record.selectedItems : [];
    const selectedItems = raw.filter((value): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) < props.items.length);
    const selected = Array.from(new Set(selectedItems)).sort((a, b) => a - b).map((index) => props.items[index]);
    return {
      ...base,
      numericValue: null,
      textValue: JSON.stringify({ selected }),
    };
  }

  if (component.type === "DailyEvidenceTracker") {
    const props = component.props as DailyEvidenceTrackerProps;
    const days = Array.isArray(record?.days) ? record.days.filter((day): day is TrackerDay => Boolean(day && typeof day === "object")) : [];
    if (days.length !== props.days || days.some((day) => typeof day.done !== "boolean")) return null;
    const daysCompleted = days.filter((day) => day.done === true).length;
    if (!numericWithinDeclaredRange(lab, beiCode, daysCompleted)) return null;
    return {
      ...base,
      numericValue: daysCompleted,
      textValue: JSON.stringify({
        trackedDays: days.length,
        consecutiveDays: longestDoneStreak(days),
      }),
    };
  }

  if (component.type === "PrivateReflection") {
    // BEI-09 and BEI-10 require evidence that the source-defined profile work
    // was completed. The learner's words remain only in the private response.
    return { ...base, numericValue: 1, textValue: null };
  }

  return null;
}

export async function synchronizeComponentEvidence(args: {
  learnerId: string;
  cohortId: string | null;
  lab: LabCartridge;
  component: LabComponent;
  payload: unknown;
  isComplete: boolean;
  observedAt: number;
}) {
  const db = getDb();
  await db.delete(beiEvidence).where(and(
    eq(beiEvidence.learnerId, args.learnerId),
    eq(beiEvidence.cartridgeId, args.lab.cartridgeId),
    eq(beiEvidence.sourceType, "component"),
    eq(beiEvidence.sourceId, args.component.id),
  ));

  if (!args.cohortId) return null;
  const projected = projectComponentEvidence(args.lab, args.component, args.payload, args.isComplete);
  if (!projected) return null;

  const id = crypto.randomUUID();
  await db.insert(beiEvidence).values({
    id,
    cohortId: args.cohortId,
    learnerId: args.learnerId,
    cartridgeId: args.lab.cartridgeId,
    beiCode: projected.beiCode,
    phase: projected.phase,
    sourceType: projected.sourceType,
    sourceId: projected.sourceId,
    numericValue: projected.numericValue,
    textValue: projected.textValue,
    observedAt: args.observedAt,
    createdAt: args.observedAt,
  });

  return { id, ...projected };
}
