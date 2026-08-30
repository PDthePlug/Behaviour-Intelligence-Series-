export type OutcomeEvidenceRow = {
  learnerId: string;
  beiCode: string;
  numericValue: number | null;
  textValue: string | null;
  sourceId: string | null;
};

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function average(values: number[]) {
  return values.length ? round1(values.reduce((total, value) => total + value, 0) / values.length) : null;
}

function numericByLearner(rows: OutcomeEvidenceRow[], beiCode: string) {
  const result = new Map<string, number>();
  for (const row of rows) {
    if (row.beiCode === beiCode && typeof row.numericValue === "number") result.set(row.learnerId, row.numericValue);
  }
  return result;
}

export function pairedShift(rows: OutcomeEvidenceRow[], preCode: string, postCode: string) {
  const pre = numericByLearner(rows, preCode);
  const post = numericByLearner(rows, postCode);
  const learnerIds = Array.from(pre.keys()).filter((learnerId) => post.has(learnerId));
  const preValues = learnerIds.map((learnerId) => pre.get(learnerId) as number);
  const postValues = learnerIds.map((learnerId) => post.get(learnerId) as number);
  const shifts = learnerIds.map((learnerId) => (post.get(learnerId) as number) - (pre.get(learnerId) as number));
  return {
    pairedLearners: learnerIds.length,
    averagePre: average(preValues),
    averagePost: average(postValues),
    averageShift: average(shifts),
  };
}

export function calibrationSummary(rows: OutcomeEvidenceRow[]) {
  const values = rows.filter((row) => row.beiCode === "BEI-03" && (row.numericValue === 0 || row.numericValue === 1));
  const correct = values.filter((row) => row.numericValue === 1).length;
  return {
    withEvidence: values.length,
    correct,
    incorrect: values.length - correct,
    correctRate: values.length ? Math.round((correct / values.length) * 100) : null,
  };
}

export function adherenceSummary(rows: OutcomeEvidenceRow[], denominator = 7) {
  const values = Array.from(numericByLearner(rows, "BEI-06").values()).filter((value) => value >= 0 && value <= denominator);
  return {
    withEvidence: values.length,
    denominator,
    averageDaysCompleted: average(values),
    fullAdherenceLearners: values.filter((value) => value === denominator).length,
  };
}

function selectedRiskLabels(textValue: string | null) {
  if (!textValue) return [] as string[];
  try {
    const parsed = JSON.parse(textValue) as { selected?: unknown };
    return Array.isArray(parsed.selected) ? parsed.selected.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
  } catch {
    return [] as string[];
  }
}

export function riskDistribution(rows: OutcomeEvidenceRow[]) {
  const riskRows = rows.filter((row) => row.beiCode === "BEI-05");
  const categories = new Map<string, Set<string>>();
  for (const row of riskRows) {
    for (const label of selectedRiskLabels(row.textValue)) {
      const learners = categories.get(label) ?? new Set<string>();
      learners.add(row.learnerId);
      categories.set(label, learners);
    }
  }
  return {
    withEvidence: new Set(riskRows.map((row) => row.learnerId)).size,
    categories: Array.from(categories.entries())
      .map(([category, learners]) => ({ category, learners: learners.size }))
      .sort((left, right) => right.learners - left.learners || left.category.localeCompare(right.category)),
  };
}

export function beiCoverage(rows: OutcomeEvidenceRow[], beiCodes: string[], activeLearners: number) {
  return beiCodes.map((beiCode) => {
    const learners = new Set(rows.filter((row) => row.beiCode === beiCode).map((row) => row.learnerId)).size;
    return {
      beiCode,
      learners,
      coverageRate: activeLearners ? Math.round((learners / activeLearners) * 100) : 0,
    };
  });
}

export function completeSourceSet(rows: OutcomeEvidenceRow[], beiCode: string, expectedSourceIds: string[]) {
  if (!expectedSourceIds.length) return 0;
  const byLearner = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.beiCode !== beiCode || !row.sourceId) continue;
    const sources = byLearner.get(row.learnerId) ?? new Set<string>();
    sources.add(row.sourceId);
    byLearner.set(row.learnerId, sources);
  }
  return Array.from(byLearner.values()).filter((sources) => expectedSourceIds.every((sourceId) => sources.has(sourceId))).length;
}
