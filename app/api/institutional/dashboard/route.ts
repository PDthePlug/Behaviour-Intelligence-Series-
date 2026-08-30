import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cohortMembers, cohorts, deployments, facilitatorObservations, labAssignments, labComponentResponses, organisations } from "@/db/schema";
import { institutionalAdminFailure } from "@/lib/institutional-auth";
import { labById, labComponents } from "@/lib/lab-catalog";

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  const cohortId = new URL(request.url).searchParams.get("cohortId")?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");

  const db = getDb();
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) return fail("That cohort does not exist.", 404);

  const [[organisation], [deployment], members, assignments, responseRows, observationRows] = await Promise.all([
    db.select({ id: organisations.id, name: organisations.name, slug: organisations.slug }).from(organisations).where(eq(organisations.id, cohort.organisationId)).limit(1),
    db.select({ id: deployments.id, name: deployments.name, status: deployments.status }).from(deployments).where(eq(deployments.id, cohort.deploymentId)).limit(1),
    db.select({ learnerId: cohortMembers.learnerId }).from(cohortMembers).where(and(eq(cohortMembers.cohortId, cohortId), eq(cohortMembers.status, "active"))),
    db.select().from(labAssignments).where(and(eq(labAssignments.cohortId, cohortId), eq(labAssignments.status, "active"))),
    db.select({ learnerId: labComponentResponses.learnerId, assignmentId: labComponentResponses.assignmentId, isComplete: labComponentResponses.isComplete }).from(labComponentResponses).where(eq(labComponentResponses.cohortId, cohortId)),
    db.select({ learnerId: facilitatorObservations.learnerId, cartridgeId: facilitatorObservations.cartridgeId }).from(facilitatorObservations).where(eq(facilitatorObservations.cohortId, cohortId)),
  ]);

  const activeLearners = members.length;
  const assignmentSummaries = assignments.map((assignment) => {
    const lab = labById(assignment.cartridgeId);
    const componentCount = lab ? labComponents(lab).length : 0;
    const assignmentResponses = responseRows.filter((row) => row.assignmentId === assignment.id);
    const completedInteractions = assignmentResponses.filter((row) => row.isComplete).length;
    const expectedInteractions = componentCount * activeLearners;
    const participatingLearners = new Set(assignmentResponses.map((row) => row.learnerId)).size;
    return {
      assignmentId: assignment.id,
      cartridgeId: assignment.cartridgeId,
      title: lab?.title ?? assignment.cartridgeId,
      componentCount,
      activeLearners: participatingLearners,
      expectedInteractions,
      completedInteractions,
      completionRate: expectedInteractions ? Math.round((completedInteractions / expectedInteractions) * 100) : 0,
      engagementRate: activeLearners ? Math.round((participatingLearners / activeLearners) * 100) : 0,
      published: Boolean(lab),
    };
  });

  const expectedInteractions = assignmentSummaries.reduce((total, assignment) => total + assignment.expectedInteractions, 0);
  const completedInteractions = assignmentSummaries.reduce((total, assignment) => total + assignment.completedInteractions, 0);
  const participatingLearners = new Set(responseRows.map((row) => row.learnerId)).size;
  const observedLearners = new Set(observationRows.map((row) => row.learnerId)).size;

  return Response.json({
    organisation: organisation ?? { id: cohort.organisationId, name: "Unknown organisation", slug: "" },
    deployment: deployment ?? { id: cohort.deploymentId, name: "Unknown deployment", status: "unknown" },
    cohort: { id: cohort.id, name: cohort.name, status: cohort.status },
    summary: {
      activeLearners,
      participatingLearners,
      observedLearners,
      activeAssignments: assignments.length,
      expectedInteractions,
      completedInteractions,
      completionRate: expectedInteractions ? Math.round((completedInteractions / expectedInteractions) * 100) : 0,
      engagementRate: activeLearners ? Math.round((participatingLearners / activeLearners) * 100) : 0,
      facilitatorObservations: observationRows.length,
    },
    labs: assignmentSummaries,
    safeguards: [
      "No private learner reflection payloads are selected by this endpoint.",
      "Institutional completion is derived from the actual assigned cartridge component count; no hard-coded Lab denominator is used.",
      "Only responses linked to this cohort assignment contribute to institutional completion.",
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
