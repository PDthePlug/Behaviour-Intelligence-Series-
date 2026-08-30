import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, deployments } from "@/db/schema";
import { requireInstitutionalAccess } from "@/lib/institutional-access";

type DeploymentPayload = { id?: string; name?: string; startsAt?: number | null; endsAt?: number | null; status?: "active" | "closed" };

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function optionalTime(value: unknown) {
  return value == null ? null : Number(value);
}

export async function GET(request: Request) {
  const access = await requireInstitutionalAccess(request, "cohorts:read");
  if (access.response) return access.response;
  const context = access.context!;
  if (!context.organisationId) return Response.json({ deployments: [] }, { headers: { "Cache-Control": "no-store" } });
  const rows = await getDb().select().from(deployments)
    .where(eq(deployments.organisationId, context.organisationId))
    .orderBy(desc(deployments.updatedAt));
  return Response.json({ deployments: rows }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireInstitutionalAccess(request, "cohorts:write");
  if (access.response) return access.response;
  const context = access.context!;
  if (!context.organisationId) return fail("Create deployments through an organisation-scoped account.", 400);

  let body: DeploymentPayload;
  try {
    body = await request.json() as DeploymentPayload;
  } catch {
    return fail("The deployment request is incomplete.");
  }

  const name = body.name?.trim().slice(0, 120) ?? "";
  if (name.length < 2) return fail("Enter a deployment name.");
  const startsAt = optionalTime(body.startsAt);
  const endsAt = optionalTime(body.endsAt);
  if (startsAt !== null && !Number.isFinite(startsAt)) return fail("The deployment start time is invalid.");
  if (endsAt !== null && !Number.isFinite(endsAt)) return fail("The deployment end time is invalid.");
  if (startsAt !== null && endsAt !== null && endsAt <= startsAt) return fail("The deployment end time must be after the start time.");
  const status = body.status === "closed" ? "closed" : "active";

  const db = getDb();
  const now = Date.now();
  if (body.id) {
    const [existing] = await db.select().from(deployments).where(eq(deployments.id, body.id)).limit(1);
    if (!existing || existing.organisationId !== context.organisationId) return fail("That deployment belongs to another organisation or does not exist.", 403);
    await db.update(deployments).set({ name, startsAt, endsAt, status, updatedAt: now }).where(eq(deployments.id, existing.id));
    await db.insert(auditEvents).values({ id: crypto.randomUUID(), organisationId: context.organisationId, actorType: "institutional_user", actorRef: context.email, action: "deployment.update", entityType: "deployment", entityId: existing.id, metadata: JSON.stringify({ startsAt, endsAt, status }), createdAt: now });
    return Response.json({ deployment: { id: existing.id, name, startsAt, endsAt, status } }, { headers: { "Cache-Control": "no-store" } });
  }

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(deployments).values({ id, organisationId: context.organisationId, name, status, startsAt, endsAt, createdAt: now, updatedAt: now }),
    db.insert(auditEvents).values({ id: crypto.randomUUID(), organisationId: context.organisationId, actorType: "institutional_user", actorRef: context.email, action: "deployment.create", entityType: "deployment", entityId: id, metadata: JSON.stringify({ startsAt, endsAt, status }), createdAt: now }),
  ]);
  return Response.json({ deployment: { id, name, startsAt, endsAt, status } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
