import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, cohortMembers, cohorts, facilitatorObservations, learnerProfiles } from "@/db/schema";
import { institutionalAdminFailure } from "@/lib/institutional-auth";
import { labById } from "@/lib/lab-catalog";

type ObservationPayload = {
  cohortId?: string;
  learnerEmail?: string;
  cartridgeId?: string;
  facilitatorEmail?: string;
  participation?: number;
  attention?: number;
  taskCompletion?: number;
  willingnessToContribute?: number;
  reflectionDepth?: number;
  evidenceQuality?: number;
  confidence?: "low" | "medium" | "high";
  indicators?: string[];
  notes?: string;
  observedAt?: number;
};

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function rating(value: unknown) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) return null;
  return numeric;
}

function observationTime(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function POST(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  let body: ObservationPayload;
  try {
    body = await request.json() as ObservationPayload;
  } catch {
    return fail("The observation request is incomplete.");
  }

  const cohortId = body.cohortId?.trim() ?? "";
  const learnerEmail = body.learnerEmail?.trim().toLowerCase() ?? "";
  const cartridgeId = body.cartridgeId?.trim() ?? "";
  const facilitatorEmail = body.facilitatorEmail?.trim().toLowerCase() ?? "";
  if (!cohortId) return fail("Select a cohort.");
  if (!/^\S+@\S+\.\S+$/.test(learnerEmail)) return fail("Enter a valid learner email.");
  if (!/^\S+@\S+\.\S+$/.test(facilitatorEmail)) return fail("Enter a valid facilitator email.");
  if (!labById(cartridgeId)) return fail("Select a published Lab cartridge.");

  const ratings = {
    participation: rating(body.participation),
    attention: rating(body.attention),
    taskCompletion: rating(body.taskCompletion),
    willingnessToContribute: rating(body.willingnessToContribute),
    reflectionDepth: rating(body.reflectionDepth),
    evidenceQuality: rating(body.evidenceQuality),
  };
  if (Object.values(ratings).every((value) => value === null)) return fail("Record at least one anchored 1–5 observation rating.");

  const confidence = body.confidence && ["low", "medium", "high"].includes(body.confidence) ? body.confidence : null;
  const indicators = Array.isArray(body.indicators)
    ? [...new Set(body.indicators.map((value) => value.trim()).filter(Boolean))].slice(0, 24)
    : [];
  const notes = body.notes?.trim().slice(0, 4000) || null;

  const db = getDb();
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort || cohort.status !== "active") return fail("That cohort is not active.", 404);
  const [learner] = await db.select({ id: learnerProfiles.id }).from(learnerProfiles).where(eq(learnerProfiles.email, learnerEmail)).limit(1);
  if (!learner) return fail("That learner profile does not exist.", 404);
  const [membership] = await db
    .select({ id: cohortMembers.id })
    .from(cohortMembers)
    .where(and(eq(cohortMembers.cohortId, cohortId), eq(cohortMembers.learnerId, learner.id), eq(cohortMembers.status, "active")))
    .limit(1);
  if (!membership) return fail("That learner is not enrolled in this cohort.", 409);

  const now = Date.now();
  const observationId = crypto.randomUUID();
  await db.batch([
    db.insert(facilitatorObservations).values({
      id: observationId,
      cohortId,
      learnerId: learner.id,
      cartridgeId,
      facilitatorEmail,
      ...ratings,
      confidence,
      indicators: JSON.stringify(indicators),
      notes,
      observedAt: observationTime(body.observedAt, now),
      createdAt: now,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId: cohort.organisationId,
      actorType: "facilitator",
      actorRef: facilitatorEmail,
      action: "facilitator.observation.create",
      entityType: "facilitator_observation",
      entityId: observationId,
      metadata: JSON.stringify({ cohortId, learnerId: learner.id, cartridgeId }),
      createdAt: now,
    }),
  ]);

  return Response.json({ saved: true, observationId, cohortId, learnerId: learner.id, cartridgeId }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
