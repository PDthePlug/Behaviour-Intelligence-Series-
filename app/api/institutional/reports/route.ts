import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, generatedReports, outcomeSnapshots } from "@/db/schema";
import { buildExecutiveReport } from "@/lib/executive-report";
import { institutionalActor, institutionalAdminFailure } from "@/lib/institutional-auth";
import { buildCohortOutcome } from "@/lib/institutional-outcomes";

type ReportRequest = { cohortId?: string };

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function parsePayload(payload: string) {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  const cohortId = new URL(request.url).searchParams.get("cohortId")?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");

  const db = getDb();
  const rows = await db.select()
    .from(generatedReports)
    .where(and(eq(generatedReports.cohortId, cohortId), eq(generatedReports.reportType, "executive_outcome")))
    .orderBy(desc(generatedReports.generatedAt))
    .limit(10);

  return Response.json({
    reports: rows.map((row) => ({
      id: row.id,
      reportType: row.reportType,
      status: row.status,
      generatedAt: row.generatedAt,
      updatedAt: row.updatedAt,
      report: parsePayload(row.payload),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  let body: ReportRequest;
  try {
    body = await request.json() as ReportRequest;
  } catch {
    return fail("The report request is incomplete.");
  }

  const cohortId = body.cohortId?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");

  const outcome = await buildCohortOutcome(cohortId);
  if (!outcome) return fail("That cohort does not exist.", 404);

  const generatedAt = Date.now();
  const report = buildExecutiveReport(outcome, generatedAt);
  const reportId = crypto.randomUUID();
  const snapshotId = crypto.randomUUID();
  const payload = JSON.stringify(report);
  const actor = institutionalActor(request);
  const db = getDb();

  await db.batch([
    db.insert(generatedReports).values({
      id: reportId,
      cohortId,
      reportType: "executive_outcome",
      status: "generated",
      payload,
      generatedAt,
      updatedAt: generatedAt,
    }),
    db.insert(outcomeSnapshots).values({
      id: snapshotId,
      cohortId,
      cartridgeId: null,
      snapshotType: "executive_outcome",
      payload: JSON.stringify(outcome),
      generatedAt,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId: outcome.organisation.id,
      actorType: "institutional_admin",
      actorRef: actor,
      action: "report.generate",
      entityType: "generated_report",
      entityId: reportId,
      metadata: JSON.stringify({ cohortId, snapshotId, reportType: "executive_outcome" }),
      createdAt: generatedAt,
    }),
  ]);

  return Response.json({ id: reportId, report }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
