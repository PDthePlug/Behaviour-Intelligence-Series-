import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, cohortMembers, cohorts, learnerProfiles } from "@/db/schema";
import { institutionalActor, institutionalAdminFailure } from "@/lib/institutional-auth";

type EnrolPayload = {
  cohortId?: string;
  learnerEmail?: string;
};

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  let body: EnrolPayload;
  try {
    body = await request.json() as EnrolPayload;
  } catch {
    return fail("The enrolment request is incomplete.");
  }

  const cohortId = body.cohortId?.trim() ?? "";
  const learnerEmail = body.learnerEmail?.trim().toLowerCase() ?? "";
  if (!cohortId) return fail("Select a cohort.");
  if (!/^\S+@\S+\.\S+$/.test(learnerEmail)) return fail("Enter a valid learner email.");

  const db = getDb();
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort || cohort.status !== "active") return fail("That cohort is not active.", 404);

  const [learner] = await db
    .select({ id: learnerProfiles.id, email: learnerProfiles.email })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.email, learnerEmail))
    .limit(1);
  if (!learner) return fail("That learner must create a BIS profile before enrolment.", 404);

  const now = Date.now();
  const membershipId = crypto.randomUUID();
  // Break-glass/control-plane enrolment can stage a membership, but cannot activate institutional evidence without learner consent.
  await db.insert(cohortMembers).values({
    id: membershipId,
    cohortId,
    learnerId: learner.id,
    status: "pending_consent",
    joinedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [cohortMembers.cohortId, cohortMembers.learnerId],
    set: { status: "pending_consent", updatedAt: now },
  });

  const [membership] = await db
    .select({ id: cohortMembers.id })
    .from(cohortMembers)
    .where(and(eq(cohortMembers.cohortId, cohortId), eq(cohortMembers.learnerId, learner.id)))
    .limit(1);

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organisationId: cohort.organisationId,
    actorType: "control_plane",
    actorRef: institutionalActor(request),
    action: "cohort.enrol.pending_consent",
    entityType: "cohort_member",
    entityId: membership?.id ?? membershipId,
    metadata: JSON.stringify({ cohortId, learnerId: learner.id, evidenceEligible: false }),
    createdAt: now,
  });

  return Response.json({
    enrolled: false,
    pendingConsent: true,
    cohortId,
    learnerId: learner.id,
    learnerEmail: learner.email,
    membershipId: membership?.id ?? membershipId,
    note: "The learner must claim an authorised enrolment link and grant participation consent before this membership becomes active or contributes institutional evidence.",
  }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
