import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, cohorts, deployments, facilitatorCohorts, organisations } from "@/db/schema";
import { requireInstitutionalAccess } from "@/lib/institutional-access";

type CohortPayload = { deploymentId?: string; name?: string; externalRef?: string };

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function mapped(rows: Array<{
  cohortId: string;
  cohortName: string;
  cohortStatus: string;
  organisationId: string;
  organisationName: string;
  organisationSlug: string;
  deploymentId: string;
  deploymentName: string;
  deploymentStatus: string;
  startsAt: number | null;
  endsAt: number | null;
  updatedAt: number;
}>) {
  return rows.map((row) => ({
    id: row.cohortId,
    name: row.cohortName,
    status: row.cohortStatus,
    organisation: { id: row.organisationId, name: row.organisationName, slug: row.organisationSlug },
    deployment: { id: row.deploymentId, name: row.deploymentName, status: row.deploymentStatus, startsAt: row.startsAt, endsAt: row.endsAt },
    updatedAt: row.updatedAt,
  }));
}

const selection = {
  cohortId: cohorts.id,
  cohortName: cohorts.name,
  cohortStatus: cohorts.status,
  organisationId: organisations.id,
  organisationName: organisations.name,
  organisationSlug: organisations.slug,
  deploymentId: deployments.id,
  deploymentName: deployments.name,
  deploymentStatus: deployments.status,
  startsAt: deployments.startsAt,
  endsAt: deployments.endsAt,
  updatedAt: cohorts.updatedAt,
};

export async function GET(request: Request) {
  const access = await requireInstitutionalAccess(request, "cohorts:read");
  if (access.response) return access.response;
  const context = access.context!;
  const db = getDb();

  let rows;
  if (context.controlPlane) {
    rows = await db.select(selection).from(cohorts)
      .innerJoin(organisations, eq(organisations.id, cohorts.organisationId))
      .innerJoin(deployments, eq(deployments.id, cohorts.deploymentId))
      .orderBy(desc(cohorts.updatedAt));
  } else if (context.role === "facilitator") {
    rows = await db.select(selection).from(facilitatorCohorts)
      .innerJoin(cohorts, eq(cohorts.id, facilitatorCohorts.cohortId))
      .innerJoin(organisations, eq(organisations.id, cohorts.organisationId))
      .innerJoin(deployments, eq(deployments.id, cohorts.deploymentId))
      .where(and(eq(facilitatorCohorts.organisationUserId, context.userId as string), eq(cohorts.organisationId, context.organisationId as string)))
      .orderBy(desc(cohorts.updatedAt));
  } else {
    rows = await db.select(selection).from(cohorts)
      .innerJoin(organisations, eq(organisations.id, cohorts.organisationId))
      .innerJoin(deployments, eq(deployments.id, cohorts.deploymentId))
      .where(eq(cohorts.organisationId, context.organisationId as string))
      .orderBy(desc(cohorts.updatedAt));
  }

  return Response.json({ cohorts: mapped(rows) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await requireInstitutionalAccess(request, "cohorts:write");
  if (access.response) return access.response;
  const context = access.context!;
  if (!context.organisationId) return fail("Create organisation cohorts through an organisation-scoped account.", 400);

  let body: CohortPayload;
  try {
    body = await request.json() as CohortPayload;
  } catch {
    return fail("The cohort request is incomplete.");
  }
  const deploymentId = body.deploymentId?.trim() ?? "";
  const name = body.name?.trim().slice(0, 120) ?? "";
  const externalRef = body.externalRef?.trim().slice(0, 120) || null;
  if (!deploymentId || name.length < 2) return fail("Select a deployment and enter a cohort name.");

  const db = getDb();
  const [deployment] = await db.select({ id: deployments.id }).from(deployments)
    .where(and(eq(deployments.id, deploymentId), eq(deployments.organisationId, context.organisationId)))
    .limit(1);
  if (!deployment) return fail("That deployment belongs to another organisation or does not exist.", 403);

  const [duplicate] = await db.select({ id: cohorts.id }).from(cohorts)
    .where(and(eq(cohorts.deploymentId, deploymentId), eq(cohorts.name, name)))
    .limit(1);
  if (duplicate) return fail("That deployment already has a cohort with this name.", 409);

  const now = Date.now();
  const cohortId = crypto.randomUUID();
  await db.batch([
    db.insert(cohorts).values({
      id: cohortId,
      organisationId: context.organisationId,
      deploymentId,
      name,
      externalRef,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId: context.organisationId,
      actorType: "institutional_user",
      actorRef: context.email,
      action: "cohort.create",
      entityType: "cohort",
      entityId: cohortId,
      metadata: JSON.stringify({ deploymentId, externalRef }),
      createdAt: now,
    }),
  ]);

  return Response.json({ cohort: { id: cohortId, deploymentId, name, externalRef, status: "active" } }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
