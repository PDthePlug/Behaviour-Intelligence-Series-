import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labComponentResponses, learnerProfiles } from "@/db/schema";
import { componentForLab, defaultLab, labById, labComponentIds, labComponents, labStepIds } from "@/lib/lab-catalog";
import { sessionFromRequest } from "@/lib/session";

type LabPayload = {
  cartridgeId?: string;
  stepId?: string;
  componentId?: string;
  payload?: unknown;
  isComplete?: boolean;
};

function failure(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function learnerForRequest(request: Request) {
  const sessionId = sessionFromRequest(request);
  if (!sessionId) return null;
  const db = getDb();
  const [profile] = await db.select({ id: learnerProfiles.id }).from(learnerProfiles).where(eq(learnerProfiles.sessionId, sessionId)).limit(1);
  return profile?.id ?? null;
}

function safeParse(payload: string) {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestedCartridgeId = new URL(request.url).searchParams.get("cartridgeId") ?? defaultLab.cartridgeId;
  const lab = labById(requestedCartridgeId);
  if (!lab) return failure("That learner Lab is not published.", 404);
  const steps = lab.timeline.steps;
  const components = labComponents(lab);
  const learnerId = await learnerForRequest(request);
  if (!learnerId) return Response.json({ responses: [], summary: { completedComponents: 0, completedSteps: [], currentStepId: steps[0]?.id, totalComponents: components.length, totalSteps: steps.length } }, { headers: { "Cache-Control": "no-store" } });

  const db = getDb();
  const rows = await db
    .select()
    .from(labComponentResponses)
    .where(and(eq(labComponentResponses.learnerId, learnerId), eq(labComponentResponses.cartridgeId, lab.cartridgeId)))
    .orderBy(desc(labComponentResponses.updatedAt));

  const completeIds = new Set(rows.filter((row) => row.isComplete).map((row) => row.componentId));
  const completedSteps = steps
    .filter((step) => step.components.every((component) => completeIds.has(component.id)))
    .map((step) => step.id);
  const currentStepId = steps.find((step) => !completedSteps.includes(step.id))?.id ?? null;

  return Response.json({
    responses: rows.map((row) => ({
      stepId: row.stepId,
      componentId: row.componentId,
      payload: safeParse(row.payload),
      isComplete: row.isComplete,
      beiTarget: row.beiTarget,
      updatedAt: row.updatedAt,
    })),
    summary: {
      completedComponents: completeIds.size,
      completedSteps,
      currentStepId,
      totalComponents: components.length,
      totalSteps: steps.length,
      cartridgeId: lab.cartridgeId,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const learnerId = await learnerForRequest(request);
  if (!learnerId) return failure("Open or create your learner profile before entering the Lab.", 401);

  const body = (await request.json()) as LabPayload;
  const lab = labById(body.cartridgeId ?? defaultLab.cartridgeId);
  if (!lab) return failure("That learner Lab is not published.", 404);
  const stepIds = labStepIds(lab);
  const componentIds = labComponentIds(lab);
  const steps = lab.timeline.steps;
  const stepId = body.stepId ?? "";
  const componentId = body.componentId ?? "";
  if (!stepIds.has(stepId) || !componentIds.has(componentId)) return failure("That interaction is not part of this learner cartridge.");
  const step = steps.find((candidate) => candidate.id === stepId);
  if (!step?.components.some((component) => component.id === componentId)) return failure("That interaction does not belong to this investigation.");

  const serialized = JSON.stringify(body.payload ?? null);
  if (serialized.length > 16_000) return failure("This reflection is too long to save in one interaction.");
  const component = componentForLab(lab, componentId);
  const now = Date.now();
  const db = getDb();

  await db.insert(labComponentResponses).values({
    id: crypto.randomUUID(),
    learnerId,
    cartridgeId: lab.cartridgeId,
    stepId,
    componentId,
    payload: serialized,
    isComplete: body.isComplete === true,
    beiTarget: component?.beiTarget,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [labComponentResponses.learnerId, labComponentResponses.cartridgeId, labComponentResponses.componentId],
    set: {
      stepId,
      payload: serialized,
      isComplete: body.isComplete === true,
      beiTarget: component?.beiTarget,
      updatedAt: now,
    },
  });

  return Response.json({ saved: true, componentId, isComplete: body.isComplete === true, updatedAt: now }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
