import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, learnerEnrolmentLinks } from "@/db/schema";
import { requireInstitutionalAccess } from "@/lib/institutional-access";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/opaque-token";

type EnrolmentLinkPayload = {
  action?: "create" | "revoke";
  cohortId?: string;
  linkId?: string;
  label?: string;
  maxUses?: number | null;
  expiresAt?: number | null;
  requireLearnerConsent?: boolean;
};

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const cohortId = new URL(request.url).searchParams.get("cohortId")?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");
  const access = await requireInstitutionalAccess(request, "enrolment:read", cohortId);
  if (access.response) return access.response;

  const rows = await getDb().select().from(learnerEnrolmentLinks)
    .where(eq(learnerEnrolmentLinks.cohortId, cohortId))
    .orderBy(desc(learnerEnrolmentLinks.createdAt));

  return Response.json({
    links: rows.map((row) => ({
      id: row.id,
      cohortId: row.cohortId,
      label: row.label,
      maxUses: row.maxUses,
      uses: row.uses,
      requireLearnerConsent: row.requireLearnerConsent,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      active: !row.revokedAt && (!row.expiresAt || row.expiresAt > Date.now()) && (!row.maxUses || row.uses < row.maxUses),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: EnrolmentLinkPayload;
  try {
    body = await request.json() as EnrolmentLinkPayload;
  } catch {
    return fail("The enrolment link request is incomplete.");
  }
  const cohortId = body.cohortId?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");
  const access = await requireInstitutionalAccess(request, "enrolment:write", cohortId);
  if (access.response) return access.response;
  const context = access.context!;
  const db = getDb();
  const now = Date.now();

  if (body.action === "revoke") {
    const linkId = body.linkId?.trim() ?? "";
    if (!linkId) return fail("Select an enrolment link.");
    const [link] = await db.select().from(learnerEnrolmentLinks)
      .where(and(eq(learnerEnrolmentLinks.id, linkId), eq(learnerEnrolmentLinks.cohortId, cohortId)))
      .limit(1);
    if (!link) return fail("That enrolment link does not exist.", 404);
    await db.update(learnerEnrolmentLinks).set({ revokedAt: now, updatedAt: now }).where(eq(learnerEnrolmentLinks.id, linkId));
    return Response.json({ revoked: true, linkId }, { headers: { "Cache-Control": "no-store" } });
  }

  const label = body.label?.trim().slice(0, 100) || "Learner enrolment";
  const maxUses = body.maxUses == null ? null : Number(body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 5000)) return fail("Maximum uses must be between 1 and 5000.");
  const expiresAt = body.expiresAt == null ? null : Number(body.expiresAt);
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= now)) return fail("Choose a future expiry date.");

  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const linkId = crypto.randomUUID();
  await db.batch([
    db.insert(learnerEnrolmentLinks).values({
      id: linkId,
      cohortId,
      tokenHash,
      label,
      maxUses,
      uses: 0,
      requireLearnerConsent: body.requireLearnerConsent !== false,
      expiresAt,
      revokedAt: null,
      createdByUserId: context.userId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId: context.organisationId,
      actorType: context.controlPlane ? "control_plane" : "institutional_user",
      actorRef: context.email,
      action: "learner.enrolment_link.create",
      entityType: "learner_enrolment_link",
      entityId: linkId,
      metadata: JSON.stringify({ cohortId, label, maxUses, expiresAt }),
      createdAt: now,
    }),
  ]);

  return Response.json({
    created: true,
    link: { id: linkId, cohortId, label, maxUses, uses: 0, expiresAt, requireLearnerConsent: body.requireLearnerConsent !== false },
    token,
    joinPath: `/join?token=${encodeURIComponent(token)}`,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
