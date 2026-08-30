import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cohorts, deployments, organisations } from "@/db/schema";
import { institutionalAdminFailure } from "@/lib/institutional-auth";

export async function GET(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  const db = getDb();
  const rows = await db
    .select({
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
    })
    .from(cohorts)
    .innerJoin(organisations, eq(organisations.id, cohorts.organisationId))
    .innerJoin(deployments, eq(deployments.id, cohorts.deploymentId))
    .orderBy(desc(cohorts.updatedAt));

  return Response.json({
    cohorts: rows.map((row) => ({
      id: row.cohortId,
      name: row.cohortName,
      status: row.cohortStatus,
      organisation: { id: row.organisationId, name: row.organisationName, slug: row.organisationSlug },
      deployment: {
        id: row.deploymentId,
        name: row.deploymentName,
        status: row.deploymentStatus,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      },
      updatedAt: row.updatedAt,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
