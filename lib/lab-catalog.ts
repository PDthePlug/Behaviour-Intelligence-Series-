import decisionLabData from "@/data/decision-lab.json";
import { habitLab, type LabCartridge, type LabComponent, type LabStep } from "@/lib/habit-lab";

export const decisionLab = decisionLabData as LabCartridge;
export const publishedLabs = [habitLab, decisionLab] as const;
export const defaultLab = habitLab;

const publishedById = new Map<string, LabCartridge>(publishedLabs.map((lab) => [lab.cartridgeId, lab]));

export function labById(cartridgeId: string | null | undefined): LabCartridge | undefined {
  return cartridgeId ? publishedById.get(cartridgeId) : undefined;
}

export function labSteps(lab: LabCartridge): LabStep[] {
  return lab.timeline.steps;
}

export function labComponents(lab: LabCartridge): LabComponent[] {
  return lab.timeline.steps.flatMap((step) => step.components);
}

export function labStepIds(lab: LabCartridge): Set<string> {
  return new Set(lab.timeline.steps.map((step) => step.id));
}

export function labComponentIds(lab: LabCartridge): Set<string> {
  return new Set(labComponents(lab).map((component) => component.id));
}

export function componentForLab(lab: LabCartridge, componentId: string): LabComponent | undefined {
  return labComponents(lab).find((component) => component.id === componentId);
}
