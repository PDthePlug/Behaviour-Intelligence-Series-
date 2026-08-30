import type { CohortOutcome } from "@/lib/institutional-outcomes";

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function signed(value: number | null) {
  if (value === null) return "insufficient evidence";
  return value > 0 ? `+${value}` : String(value);
}

export function buildExecutiveReport(outcome: CohortOutcome, generatedAt = Date.now()) {
  const labs = outcome.labs.map((lab) => {
    const base = {
      cartridgeId: lab.cartridgeId,
      title: lab.title,
      engagementRate: lab.engagementRate,
      completionRate: lab.completionRate,
      participatingLearners: lab.activeLearners,
    };

    if (lab.outcomes.suppressed) {
      return {
        ...base,
        outcomeStatus: "suppressed" as const,
        narrative: `Outcome evidence is withheld because the cohort is below the minimum aggregate size of ${lab.outcomes.minimumAggregateSize}.`,
      };
    }

    const evidence = lab.outcomes;
    const topRiskCategories = evidence.riskDistribution.categories.slice(0, 3);
    return {
      ...base,
      outcomeStatus: "descriptive" as const,
      evidenceLearners: evidence.evidenceLearners,
      indexShift: evidence.indexShift,
      confidenceShift: evidence.confidenceShift,
      predictionCalibration: evidence.predictionCalibration,
      experimentAdherence: evidence.experimentAdherence,
      topRiskCategories,
      identityEvidenceCompleteLearners: evidence.identityEvidenceCompleteLearners,
      profileEvidenceCompleteLearners: evidence.profileEvidenceCompleteLearners,
      narrative: [
        `${pct(lab.engagementRate)} of active learners engaged with this Lab and ${pct(lab.completionRate)} of expected interactions were completed.`,
        evidence.indexShift.pairedLearners
          ? `Among ${evidence.indexShift.pairedLearners} learners with paired BEI-01/BEI-07 evidence, the descriptive average shift was ${signed(evidence.indexShift.averageShift)} points.`
          : "There is not yet enough paired BEI-01/BEI-07 evidence to describe a pre/post shift.",
        evidence.experimentAdherence.withEvidence
          ? `The source-defined seven-day experiment has evidence for ${evidence.experimentAdherence.withEvidence} learners, averaging ${evidence.experimentAdherence.averageDaysCompleted ?? 0}/7 completed days.`
          : "Seven-day experiment evidence is not yet available.",
      ].join(" "),
    };
  });

  const operationalActions: string[] = [];
  if (outcome.summary.engagementRate < 80) operationalActions.push("Investigate participation barriers before interpreting outcome patterns as representative of the full cohort.");
  if (outcome.summary.completionRate < 70) operationalActions.push("Prioritise completion of assigned Lab interactions before the next reporting snapshot.");
  if (outcome.summary.observedLearners < outcome.summary.activeLearners) operationalActions.push("Increase facilitator observation coverage to strengthen triangulation between learner evidence and external observation.");
  if (outcome.summary.outcomeAggregationSuppressed) operationalActions.push("Do not publish outcome aggregates until the minimum privacy-preserving cohort size is reached.");
  if (!operationalActions.length) operationalActions.push("Continue the current evidence cycle and generate the next snapshot after the active experiment window closes.");

  return {
    schemaVersion: "bis-executive-outcome-report-v1",
    reportType: "executive_outcome",
    generatedAt,
    organisation: outcome.organisation,
    deployment: outcome.deployment,
    cohort: outcome.cohort,
    executiveSummary: {
      activeLearners: outcome.summary.activeLearners,
      participatingLearners: outcome.summary.participatingLearners,
      engagementRate: outcome.summary.engagementRate,
      completionRate: outcome.summary.completionRate,
      facilitatorObservations: outcome.summary.facilitatorObservations,
      evidenceRows: outcome.summary.evidenceRows,
      assignedLabs: outcome.summary.activeAssignments,
    },
    labs,
    operationalActions,
    evidenceBoundary: {
      status: "descriptive",
      statement: "This report describes source-defined BIS programme evidence. It does not establish psychometric validity, clinical diagnosis, or causal programme impact.",
      privacy: "Private learner reflection words are excluded. Institutional reporting uses participation, governed BEI evidence and permitted aggregate observation data only.",
      minimumAggregateSize: 5,
    },
    safeguards: outcome.safeguards,
  };
}

export type ExecutiveOutcomeReport = ReturnType<typeof buildExecutiveReport>;
