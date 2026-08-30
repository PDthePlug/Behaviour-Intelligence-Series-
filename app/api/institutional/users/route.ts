import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, cohorts, facilitatorCohorts, organisationUserInvites, organisationUsers } from "@/db/schema";
import { requireInstitutionalAccess, type InstitutionalRole } from "@/lib/institutional-access";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/opaque-token";

type InvitePayload = { email?: string; role?: InstitutionalRole; cohortIds?: string[] };
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const roles = new Set<InstitutionalRole>(["owner", "admin", "facilitator", "viewer"]);

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const access = await requireInstitutionalAccess(request, "users:read");
  if (access.response) return access.response;
  const context = access.context!;
  const db = getDb();

  const rows = context.controlPlane
    ? await db.select().from(organisationUsers).orderBy(desc(organisationUsers.updatedAt)).limit(250)
    : await db.select().from(organisationUsers).where(eq(organisationUsers.organisationId, context.organisationId as string)).orderBy(desc(organisationUsers.updatedAt));

  return Response.json({
    users: rows.map((row) => ({
      id: row.id,
      organisationId: row.organisationId,
      email: row.email,
      firstName: row.firstName,
      surname: row.surname,
      role: row.role,
      status: row.status,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireInstitutionalAccess(request, "users:write");
  if (access.response) return access.response;
  const context = access.context!;
  if (context.controlPlane && !context.organisationId) return fail("Use institutional bootstrap to create the first organisation owner.", 400);

  let body: InvitePayload;
  try {
    body = await request.json() as InvitePayload;
  } catch {
    return fail("The staff invitation request is incomplete.");
  }

  const email = body.email?.trim().toLowerCase().slice(0, 180) ?? "";
  const role = body.role ?? "viewer";
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid staff email address.");
  if (!roles.has(role)) return fail("Choose a valid institutional role.");
  if (role === "owner" && context.role !== "owner") return fail("Only an organisation owner can invite another owner.", 403);

  const organisationId = context.organisationId as string;
  const requestedCohorts = [...new Set((body.cohortIds ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 100);
  const db = getDb();
  if (requestedCohorts.length) {
    const matching = await db.select({ id: cohorts.id }).from(cohorts)
      .where(and(eq(cohorts.organisationId, organisationId), inArray(cohorts.id, requestedCohorts)));
    if (matching.length !== requestedCohorts.length) return fail("One or more facilitator cohorts belong to another organisation.", 403);
  }

  const [existing] = await db.select().from(organisationUsers)
    .where(and(eq(organisationUsers.organisationId, organisationId), eq(organisationUsers.email, email)))
    .limit(1);
  if (existing?.status === "active") return fail("That staff member already has an active institutional account.", 409);

  const now = Date.now();
  const userId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await db.update(organisationUsers).set({ role, status: "invited", updatedAt: now }).where(eq(organisationUsers.id, userId));
    await db.delete(facilitatorCohorts).where(eq(facilitatorCohorts.organisationUserId, userId));
  } else {
    await db.insert(organisationUsers).values({
      id: userId,
      organisationId,
      email,
      role,
      status: "invited",
      createdAt: now,
      updatedAt: now,
    });
  }

  if (role === "facilitator") {
    for (const cohortId of requestedCohorts) {
      await db.insert(facilitatorCohorts).values({ id: crypto.randomUUID(), organisationUserId: userId, cohortId, createdAt: now });
    }
  }

  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const inviteId = crypto.randomUUID();
  await db.batch([
    db.insert(organisationUserInvites).values({
      id: inviteId,
      organisationId,
      email,
      role,
      tokenHash,
      expiresAt: now + INVITE_TTL_MS,
      acceptedAt: null,
      createdByUserId: context.userId,
      createdAt: now,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId,
      actorType: "institutional_user",
      actorRef: context.email,
      action: "institutional.user.invite",
      entityType: "organisation_user",
      entityId: userId,
      metadata: JSON.stringify({ email, role, cohortIds: requestedCohorts }),
      createdAt: now,
    }),
  ]);

  return Response.json({
    invited: true,
    user: { id: userId, email, role, cohortIds: requestedCohorts },
    invitation: { id: inviteId, token, expiresAt: now + INVITE_TTL_MS, acceptPath: `/institutional?invite=${encodeURIComponent(token)}` },
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
