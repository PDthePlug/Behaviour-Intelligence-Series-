import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, cohortMembers, cohorts, labAssignments, learnerConsents, learnerEnrolmentLinks, learnerProfiles, organisations } from "@/db/schema";
import { labById } from "@/lib/lab-catalog";
import { hashOpaqueToken } from "@/lib/opaque-token";
import { sessionFromRequest } from "@/lib/session";

type ClaimPayload = { token?: string; consentGranted?: boolean };

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function enrolmentByToken(token: string) {
  const tokenHash = await hashOpaqueToken(token);
  const db = getDb();
  const [row] = await db.select({
    linkId: learnerEnrolmentLinks.id,
    cohortId: learnerEnrolmentLinks.cohortId,
    label: learnerEnrolmentLinks.label,
    maxUses: learnerEnrolmentLinks.maxUses,
    uses: learnerEnrolmentLinks.uses,
    requireLearnerConsent: learnerEnrolmentLinks.requireLearnerConsent,
    expiresAt: learnerEnrolmentLinks.expiresAt,
    revokedAt: learnerEnrolmentLinks.revokedAt,
    cohortName: cohorts.name,
    cohortStatus: cohorts.status,
    organisationId: organisations.id,
    organisationName: organisations.name,
    organisationStatus: organisations.status,
  }).from(learnerEnrolmentLinks)
    .innerJoin(cohorts, eq(cohorts.id, learnerEnrolmentLinks.cohortId))
    .innerJoin(organisations, eq(organisations.id, cohorts.organisationId))
    .where(eq(learnerEnrolmentLinks.tokenHash, tokenHash))
    .limit(1);
  return row ?? null;
}

function linkIsActive(link: NonNullable<Awaited<ReturnType<typeof enrolmentByToken>>>) {
  const now = Date.now();
  return !link.revokedAt
    && link.cohortStatus === "active"
    && link.organisationStatus === "active"
    && (!link.expiresAt || link.expiresAt > now)
    && (!link.maxUses || link.uses < link.maxUses);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token) return fail("Open a valid learner enrolment link.");
  const link = await enrolmentByToken(token);
  if (!link || !linkIsActive(link)) return fail("This learner enrolment link is invalid, expired or closed.", 410);

  const assignments = await getDb().select({ cartridgeId: labAssignments.cartridgeId, status: labAssignments.status, startsAt: labAssignments.startsAt, dueAt: labAssignments.dueAt })
    .from(labAssignments).where(eq(labAssignments.cohortId, link.cohortId));

  return Response.json({
    enrolment: {
      label: link.label,
      organisation: { id: link.organisationId, name: link.organisationName },
      cohort: { id: link.cohortId, name: link.cohortName },
      requireLearnerConsent: link.requireLearnerConsent,
      expiresAt: link.expiresAt,
      labs: assignments.map((assignment) => ({
        cartridgeId: assignment.cartridgeId,
        title: labById(assignment.cartridgeId)?.title ?? assignment.cartridgeId,
        status: assignment.status,
        startsAt: assignment.startsAt,
        dueAt: assignment.dueAt,
      })),
      privacyStatement: "Your private reflection words are not shared with the institution. Institutional reporting uses participation and governed programme evidence only.",
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: ClaimPayload;
  try {
    body = await request.json() as ClaimPayload;
  } catch {
    return fail("The enrolment request is incomplete.");
  }
  const token = body.token?.trim() ?? "";
  if (!token) return fail("Open a valid learner enrolment link.");
  const link = await enrolmentByToken(token);
  if (!link || !linkIsActive(link)) return fail("This learner enrolment link is invalid, expired or closed.", 410);
  if (link.requireLearnerConsent && body.consentGranted !== true) return fail("Learner participation consent is required before joining this cohort.", 409);

  const sessionId = sessionFromRequest(request);
  if (!sessionId) return fail("Open or create your learner profile before joining this cohort.", 401);
  const db = getDb();
  const [learner] = await db.select({ id: learnerProfiles.id, email: learnerProfiles.email }).from(learnerProfiles).where(eq(learnerProfiles.sessionId, sessionId)).limit(1);
  if (!learner) return fail("Open or create your learner profile before joining this cohort.", 401);

  const [existing] = await db.select().from(cohortMembers)
    .where(and(eq(cohortMembers.cohortId, link.cohortId), eq(cohortMembers.learnerId, learner.id)))
    .limit(1);
  const now = Date.now();

  if (link.requireLearnerConsent) {
    await db.insert(learnerConsents).values({
      id: crypto.randomUUID(),
      learnerId: learner.id,
      cohortId: link.cohortId,
      consentType: "learner_participation",
      granted: true,
      capturedAt: now,
      revokedAt: null,
      source: "digital_enrolment_link",
    }).onConflictDoUpdate({
      target: [learnerConsents.learnerId, learnerConsents.cohortId, learnerConsents.consentType],
      set: { granted: true, capturedAt: now, revokedAt: null, source: "digital_enrolment_link" },
    });
  }

  if (existing) {
    if (existing.status !== "active") {
      await db.update(cohortMembers).set({ status: "active", updatedAt: now }).where(eq(cohortMembers.id, existing.id));
    }
    return Response.json({ joined: true, alreadyMember: true, cohortId: link.cohortId, cohortName: link.cohortName }, { headers: { "Cache-Control": "no-store" } });
  }

  const memberId = crypto.randomUUID();
  await db.batch([
    db.insert(cohortMembers).values({
      id: memberId,
      cohortId: link.cohortId,
      learnerId: learner.id,
      status: "active",
      joinedAt: now,
      updatedAt: now,
    }),
    db.update(learnerEnrolmentLinks).set({ uses: link.uses + 1, updatedAt: now }).where(eq(learnerEnrolmentLinks.id, link.linkId)),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId: link.organisationId,
      actorType: "learner",
      actorRef: learner.email,
      action: "learner.cohort.join",
      entityType: "cohort_member",
      entityId: memberId,
      metadata: JSON.stringify({ cohortId: link.cohortId, enrolmentLinkId: link.linkId, consentCaptured: link.requireLearnerConsent }),
      createdAt: now,
    }),
  ]);

  return Response.json({ joined: true, alreadyMember: false, cohortId: link.cohortId, cohortName: link.cohortName }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
