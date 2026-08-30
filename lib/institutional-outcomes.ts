import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  beiEvidence,
  cohortMembers,
  cohorts,
  deployments,
  facilitatorObservations,
  labAssignments,
  labComponentResponses,
  organisations,
} from "@/db/schema";
import { labById, labComponents } from "@/lib/lab-catalog";
import {
  adherenceSummary,
  beiCoverage,
  calibrationSummary,
  completeSourceSet,
  pairedShift,
  riskDistribution,
} from "@/lib/outcome-aggregation";

export const MIN_OUTCOME_AGGREGATE_SIZE = 5;

export async function buildCohortOutcome(cohortId: string) {
  const db = getDb();
  const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) return null;

  const [[organisation], [deployment], members, assignments, responseRows, observationRows, evidenceRows] = await Promise.all([
    db.select({ id: organisations.id, name: organisations.name, slug: organisations.slug })
      .from(organisations)
      .where(eq(organisations.id, cohort.organisationId))
      .limit(1),
    db.select({ id: deployments.id, name: deployments.name, status: deployments.status, startsAt: deployments.startsAt, endsAt: deployments.endsAt })
      .from(deployments)
      .where(eq(deployments.id, cohort.deploymentId))
      .limit(1),
    db.select({ learnerId: cohortMembers.learnerId })
      .from(cohortMembers)
      .where(and(eq(cohortMembers.cohortId, cohortId), eq(cohortMembers.status, "active"))),
    db.select().from(labAssignments)
      .where(and(eq(labAssignments.cohortId, cohortId), eq(labAssignments.status, "active"))),
    db.select({ learnerId: labComponentResponses.learnerId, assignmentId: labComponentResponses.assignmentId, isComplete: labComponentResponses.isComplete })
      .from(labComponentResponses)
      .where(eq(labComponentResponses.cohortId, cohortId)),
    db.select({ learnerId: facilitatorObservations.learnerId, cartridgeId: facilitatorObservations.cartridgeId })
      .from(facilitatorObservations)
      .where(eq(facilitatorObservations.cohortId, cohortId)),
    db.select({
      learnerId: beiEvidence.learnerId,
      cartridgeId: beiEvidence.cartridgeId,
      beiCode: beiEvidence.beiCode,
      numericValue: beiEvidence.numericValue,
      textValue: beiEvidence.textValue,
      sourceId: beiEvidence.sourceId,
    }).from(beiEvidence).where(eq(beiEvidence.cohortId, cohortId)),
  ]);

  const activeLearners = members.length;
  const activeLearnerIds = new Set(members.map((member) => member.learnerId));
  const activeEvidenceRows = evidenceRows.filter((row) => activeLearnerIds.has(row.learnerId));
  const suppressOutcomes = activeLearners < MIN_OUTCOME_AGGREGATE_SIZE;

  const assignmentSummaries = assignments.map((assignment) => {
    const lab = labById(assignment.cartridgeId);
    const components = lab ? labComponents(lab) : [];
    const componentCount = components.length;
    const assignmentResponses = responseRows.filter((row) => row.assignmentId === assignment.id && activeLearnerIds.has(row.learnerId));
    const completedInteractions = assignmentResponses.filter((row) => row.isComplete).length;
    const expectedInteractions = componentCount * activeLearners;
    const participatingLearners = new Set(assignmentResponses.map((row) => row.learnerId)).size;
    const labEvidence = activeEvidenceRows.filter((row) => row.cartridgeId === assignment.cartridgeId);
    const beiCodes = lab?.beiSchema.map((indicator) => indicator.code) ?? [];
    const identitySourceIds = components.filter((component) => component.beiTarget === "BEI-09").map((component) => component.id);
    const profileSourceIds = components.filter((component) => component.beiTarget === "BEI-10").map((component) => component.id);

    const outcomes = suppressOutcomes ? {
      suppressed: true as const,
      minimumAggregateSize: MIN_OUTCOME_AGGREGATE_SIZE,
      reason: "Outcome aggregates are suppressed for very small cohorts to reduce individual re-identification risk.",
    } : {
      suppressed: false as const,
      evidenceLearners: new Set(labEvidence.map((row) => row.learnerId)).size,
      coverage: beiCoverage(labEvidence, beiCodes, activeLearners),
      indexShift: pairedShift(labEvidence, "BEI-01", "BEI-07"),
      confidenceShift: pairedShift(labEvidence, "BEI-04", "BEI-08"),
      predictionCalibration: calibrationSummary(labEvidence),
      experimentAdherence: adherenceSummary(labEvidence, 7),
      riskDistribution: riskDistribution(labEvidence),
      identityEvidenceCompleteLearners: completeSourceSet(labEvidence, "BEI-09", identitySourceIds),
      profileEvidenceCompleteLearners: completeSourceSet(labEvidence, "BEI-10", profileSourceIds),
      measurementStatus: "descriptive" as const,
      interpretation: "These are source-defined programme indicators and paired descriptive shifts. They are not psychometric validation or causal impact estimates.",
    };

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
      outcomes,
    };
  });

  const expectedInteractions = assignmentSummaries.reduce((total, assignment) => total + assignment.expectedInteractions, 0);
  const completedInteractions = assignmentSummaries.reduce((total, assignment) => total + assignment.completedInteractions, 0);
  const participatingLearners = new Set(responseRows.filter((row) => activeLearnerIds.has(row.learnerId)).map((row) => row.learnerId)).size;
  const observedLearners = new Set(observationRows.filter((row) => activeLearnerIds.has(row.learnerId)).map((row) => row.learnerId)).size;

  return {
    organisation: organisation ?? { id: cohort.organisationId, name: "Unknown organisation", slug: "" },
    deployment: deployment ?? { id: cohort.deploymentId, name: "Unknown deployment", status: "unknown", startsAt: null, endsAt: null },
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
      evidenceRows: activeEvidenceRows.length,
      outcomeAggregationSuppressed: suppressOutcomes,
    },
    labs: assignmentSummaries,
    safeguards: [
      "No private learner reflection payloads are selected by this service.",
      "Institutional completion is derived from the actual assigned cartridge component count; no hard-coded Lab denominator is used.",
      "Only responses and evidence linked to active members of this cohort contribute to institutional reporting.",
      "BEI-05 is aggregated as source risk categories, never as an invented severity score.",
      "BEI-06 is aggregated as source-defined completed days out of seven.",
      `Outcome aggregates are suppressed below ${MIN_OUTCOME_AGGREGATE_SIZE} active learners.`,
      "Pre/post shifts are descriptive paired differences, not causal impact or psychometric validation claims.",
    ],
  };
}

export type CohortOutcome = NonNullable<Awaited<ReturnType<typeof buildCohortOutcome>>>;
