import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, beiEvidence, cohorts, labComponentResponses } from "@/db/schema";
import { projectComponentEvidence } from "@/lib/evidence-engine";
import { institutionalActor, institutionalAdminFailure } from "@/lib/institutional-auth";
import { componentForLab, labById } from "@/lib/lab-catalog";

type RebuildPayload = {
  cohortId?: string;
};

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeParse(payload: string) {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  const body = (await request.json()) as RebuildPayload;
  const cohortId = body.cohortId?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");

  const db = getDb();
  const [cohort] = await db.select({ id: cohorts.id, organisationId: cohorts.organisationId }).from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) return fail("That cohort does not exist.", 404);

  const responses = await db.select({
    learnerId: labComponentResponses.learnerId,
    cartridgeId: labComponentResponses.cartridgeId,
    componentId: labComponentResponses.componentId,
    payload: labComponentResponses.payload,
    isComplete: labComponentResponses.isComplete,
    updatedAt: labComponentResponses.updatedAt,
  }).from(labComponentResponses).where(eq(labComponentResponses.cohortId, cohortId));

  const projectedRows: Array<typeof beiEvidence.$inferInsert> = [];
  const counts: Record<string, number> = {};

  for (const response of responses) {
    const lab = labById(response.cartridgeId);
    if (!lab) continue;
    const component = componentForLab(lab, response.componentId);
    if (!component) continue;
    const projected = projectComponentEvidence(lab, component, safeParse(response.payload), response.isComplete);
    if (!projected) continue;

    projectedRows.push({
      id: crypto.randomUUID(),
      cohortId,
      learnerId: response.learnerId,
      cartridgeId: response.cartridgeId,
      beiCode: projected.beiCode,
      phase: projected.phase,
      sourceType: projected.sourceType,
      sourceId: projected.sourceId,
      numericValue: projected.numericValue,
      textValue: projected.textValue,
      observedAt: response.updatedAt,
      createdAt: Date.now(),
    });
    counts[projected.beiCode] = (counts[projected.beiCode] ?? 0) + 1;
  }

  await db.delete(beiEvidence).where(eq(beiEvidence.cohortId, cohortId));
  if (projectedRows.length) await db.insert(beiEvidence).values(projectedRows);

  const now = Date.now();
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organisationId: cohort.organisationId,
    actorType: "institutional-admin",
    actorRef: institutionalActor(request),
    action: "evidence.rebuild",
    entityType: "cohort",
    entityId: cohortId,
    metadata: JSON.stringify({ responseRows: responses.length, evidenceRows: projectedRows.length, beiCounts: counts }),
    createdAt: now,
  });

  return Response.json({
    rebuilt: true,
    cohortId,
    sourceResponses: responses.length,
    evidenceRows: projectedRows.length,
    beiCounts: counts,
    safeguards: [
      "Private learner writing is not copied into the institutional evidence store.",
      "Risk inventories are retained as selected source categories, not converted into severity scores.",
      "Experiment adherence is retained as the source-defined completed-days count out of seven.",
    ],
    rebuiltAt: now,
  }, { headers: { "Cache-Control": "no-store" } });
}
