"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileText, KeyRound, Printer, RefreshCw, ShieldCheck, Users } from "lucide-react";

type CohortRecord = {
  id: string;
  name: string;
  status: string;
  organisation: { id: string; name: string; slug: string };
  deployment: { id: string; name: string; status: string; startsAt: number | null; endsAt: number | null };
  updatedAt: number;
};

type Shift = { pairedLearners: number; averagePre: number | null; averagePost: number | null; averageShift: number | null };
type LabOutcome = {
  assignmentId: string;
  cartridgeId: string;
  title: string;
  activeLearners: number;
  completionRate: number;
  engagementRate: number;
  outcomes:
    | { suppressed: true; minimumAggregateSize: number; reason: string }
    | {
        suppressed: false;
        evidenceLearners: number;
        indexShift: Shift;
        confidenceShift: Shift;
        predictionCalibration: { withEvidence: number; correctRate: number | null };
        experimentAdherence: { withEvidence: number; denominator: number; averageDaysCompleted: number | null; fullAdherenceLearners: number };
        riskDistribution: { withEvidence: number; categories: Array<{ category: string; learners: number }> };
        identityEvidenceCompleteLearners: number;
        profileEvidenceCompleteLearners: number;
        measurementStatus: "descriptive";
        interpretation: string;
      };
};

type Dashboard = {
  organisation: { id: string; name: string; slug: string };
  deployment: { id: string; name: string; status: string };
  cohort: { id: string; name: string; status: string };
  summary: {
    activeLearners: number;
    participatingLearners: number;
    observedLearners: number;
    activeAssignments: number;
    completionRate: number;
    engagementRate: number;
    facilitatorObservations: number;
    evidenceRows: number;
    outcomeAggregationSuppressed: boolean;
  };
  labs: LabOutcome[];
  safeguards: string[];
};

type ExecutiveReport = {
  schemaVersion: string;
  reportType: string;
  generatedAt: number;
  organisation: { id: string; name: string; slug: string };
  deployment: { id: string; name: string; status: string };
  cohort: { id: string; name: string; status: string };
  executiveSummary: {
    activeLearners: number;
    participatingLearners: number;
    engagementRate: number;
    completionRate: number;
    facilitatorObservations: number;
    evidenceRows: number;
    assignedLabs: number;
  };
  labs: Array<{
    cartridgeId: string;
    title: string;
    engagementRate: number;
    completionRate: number;
    participatingLearners: number;
    outcomeStatus: "suppressed" | "descriptive";
    narrative: string;
  }>;
  operationalActions: string[];
  evidenceBoundary: { status: string; statement: string; privacy: string; minimumAggregateSize: number };
  safeguards: string[];
};

function formatDate(value: number | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function metric(value: number | null, suffix = "") {
  return value === null ? "—" : `${value}${suffix}`;
}

export function InstitutionalConsole() {
  const [adminKey, setAdminKey] = useState("");
  const [cohorts, setCohorts] = useState<CohortRecord[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    setAdminKey(window.sessionStorage.getItem("bis-institutional-admin-key") ?? "");
  }, []);

  const headers = useMemo(() => ({ "x-bis-admin-key": adminKey }), [adminKey]);

  async function unlock() {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/institutional/cohorts", { headers, cache: "no-store" });
      const data = await response.json() as { error?: string; cohorts?: CohortRecord[] };
      if (!response.ok) throw new Error(data.error ?? "Institutional access failed.");
      const next = data.cohorts ?? [];
      window.sessionStorage.setItem("bis-institutional-admin-key", adminKey);
      setCohorts(next);
      if (!selectedCohortId && next[0]) setSelectedCohortId(next[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Institutional access failed.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCohort(cohortId: string) {
    if (!cohortId) return;
    setLoading(true);
    setError("");
    try {
      const [dashboardResponse, reportsResponse] = await Promise.all([
        fetch(`/api/institutional/dashboard?cohortId=${encodeURIComponent(cohortId)}`, { headers, cache: "no-store" }),
        fetch(`/api/institutional/reports?cohortId=${encodeURIComponent(cohortId)}`, { headers, cache: "no-store" }),
      ]);
      const dashboardData = await dashboardResponse.json() as Dashboard & { error?: string };
      if (!dashboardResponse.ok) throw new Error(dashboardData.error ?? "Cohort evidence could not be loaded.");
      const reportsData = await reportsResponse.json() as { reports?: Array<{ report: ExecutiveReport | null }> };
      setDashboard(dashboardData);
      setReport(reportsData.reports?.[0]?.report ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Cohort evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCohortId && cohorts.length) void loadCohort(selectedCohortId);
    // load is intentionally keyed to selected cohort after access has been unlocked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCohortId, cohorts.length]);

  async function generateReport() {
    if (!selectedCohortId) return;
    setReporting(true);
    setError("");
    try {
      const response = await fetch("/api/institutional/reports", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", "x-bis-actor": "institutional-console" },
        body: JSON.stringify({ cohortId: selectedCohortId }),
      });
      const data = await response.json() as { error?: string; report?: ExecutiveReport };
      if (!response.ok || !data.report) throw new Error(data.error ?? "The executive report could not be generated.");
      setReport(data.report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The executive report could not be generated.");
    } finally {
      setReporting(false);
    }
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bis-outcome-report-${report.cohort.id}-${report.generatedAt}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!cohorts.length) {
    return (
      <main className="institutional-gate">
        <section>
          <div className="institutional-mark"><ShieldCheck size={22} /><span>BIS Outcomes Cloud</span></div>
          <h1>Institutional Evidence Console</h1>
          <p>Authorised institutional operations only. The access key stays in this browser session and is sent only to protected BIS institutional APIs.</p>
          <label>Institutional admin key<input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} /></label>
          <button disabled={!adminKey || loading} onClick={() => void unlock()}><KeyRound size={16} />{loading ? "Verifying…" : "Open evidence console"}</button>
          {error && <div className="institutional-error">{error}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="institutional-console">
      <header className="institutional-console-header">
        <div><span>BIS OUTCOMES CLOUD</span><h1>Institutional Evidence Console</h1><p>Descriptive programme evidence. Private learner reflection words are excluded.</p></div>
        <div className="institutional-controls">
          <select value={selectedCohortId} onChange={(event) => setSelectedCohortId(event.target.value)}>
            {cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.organisation.name} · {cohort.name}</option>)}
          </select>
          <button className="quiet" disabled={loading} onClick={() => void loadCohort(selectedCohortId)}><RefreshCw size={15} />Refresh</button>
        </div>
      </header>

      {error && <div className="institutional-error wide">{error}</div>}
      {!dashboard ? <div className="institutional-loading">Loading governed cohort evidence…</div> : <>
        <section className="institutional-context">
          <div><small>Organisation</small><strong>{dashboard.organisation.name}</strong></div>
          <div><small>Deployment</small><strong>{dashboard.deployment.name}</strong></div>
          <div><small>Cohort</small><strong>{dashboard.cohort.name}</strong></div>
          <div><small>Evidence status</small><strong>{dashboard.summary.outcomeAggregationSuppressed ? "Protected / suppressed" : "Descriptive"}</strong></div>
        </section>

        <section className="institutional-metrics">
          <Metric icon={<Users size={18} />} label="Active learners" value={String(dashboard.summary.activeLearners)} note={`${dashboard.summary.participatingLearners} participating`} />
          <Metric icon={<BarChart3 size={18} />} label="Engagement" value={`${dashboard.summary.engagementRate}%`} note={`${dashboard.summary.completionRate}% interaction completion`} />
          <Metric icon={<ShieldCheck size={18} />} label="Observed learners" value={String(dashboard.summary.observedLearners)} note={`${dashboard.summary.facilitatorObservations} facilitator observations`} />
          <Metric icon={<FileText size={18} />} label="Governed evidence" value={String(dashboard.summary.evidenceRows)} note={`${dashboard.summary.activeAssignments} assigned Labs`} />
        </section>

        <section className="institutional-labs">
          <div className="section-heading"><div><small>ASSIGNED LABS</small><h2>Evidence by intervention</h2></div><span>Workbook-defined measures only</span></div>
          <div className="lab-outcome-grid">{dashboard.labs.map((lab) => <LabOutcomeCard key={lab.assignmentId} lab={lab} />)}</div>
        </section>

        <section className="institutional-report-section">
          <div className="section-heading">
            <div><small>EXECUTIVE ARTEFACT</small><h2>Outcome Report</h2></div>
            <div className="report-actions"><button onClick={() => void generateReport()} disabled={reporting}><FileText size={15} />{reporting ? "Generating…" : "Generate snapshot"}</button>{report && <><button className="quiet" onClick={downloadReport}><Download size={15} />JSON</button><button className="quiet" onClick={() => window.print()}><Printer size={15} />Print</button></>}</div>
          </div>
          {report ? <ReportView report={report} /> : <div className="empty-report">Generate a report to freeze the current evidence state into an auditable executive snapshot.</div>}
        </section>

        <section className="institutional-boundary"><ShieldCheck size={18} /><div><strong>Evidence boundary</strong><p>These outputs describe source-defined BIS programme indicators and paired descriptive shifts. They do not establish psychometric validity, diagnosis or causal programme impact. Aggregates are suppressed for cohorts below five active learners.</p></div></section>
      </>}
    </main>
  );
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className="institutional-metric"><div>{icon}<span>{label}</span></div><strong>{value}</strong><p>{note}</p></article>;
}

function LabOutcomeCard({ lab }: { lab: LabOutcome }) {
  return <article className="lab-outcome-card">
    <header><div><small>{lab.cartridgeId}</small><h3>{lab.title.replace(/ v3\.0$/, "")}</h3></div><span>{lab.engagementRate}% engaged</span></header>
    <div className="lab-progress"><i style={{ width: `${lab.completionRate}%` }} /></div>
    <p className="lab-completion">{lab.completionRate}% interaction completion · {lab.activeLearners} participating learners</p>
    {lab.outcomes.suppressed ? <div className="suppressed"><ShieldCheck size={16} /><p>{lab.outcomes.reason}</p></div> : <div className="lab-evidence-grid">
      <Evidence label="Index shift" value={metric(lab.outcomes.indexShift.averageShift)} note={`${lab.outcomes.indexShift.pairedLearners} paired`} />
      <Evidence label="Confidence shift" value={metric(lab.outcomes.confidenceShift.averageShift)} note={`${lab.outcomes.confidenceShift.pairedLearners} paired`} />
      <Evidence label="Experiment" value={metric(lab.outcomes.experimentAdherence.averageDaysCompleted, "/7")} note={`${lab.outcomes.experimentAdherence.withEvidence} with evidence`} />
      <Evidence label="Calibration" value={metric(lab.outcomes.predictionCalibration.correctRate, "%")} note={`${lab.outcomes.predictionCalibration.withEvidence} with evidence`} />
      <div className="risk-evidence"><small>Top declared risk areas</small>{lab.outcomes.riskDistribution.categories.length ? <ul>{lab.outcomes.riskDistribution.categories.slice(0, 4).map((item) => <li key={item.category}><span>{item.category}</span><b>{item.learners}</b></li>)}</ul> : <p>No risk inventory evidence yet.</p>}</div>
    </div>}
  </article>;
}

function Evidence({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="evidence-stat"><small>{label}</small><strong>{value}</strong><span>{note}</span></div>;
}

function ReportView({ report }: { report: ExecutiveReport }) {
  return <article className="executive-report" id="bis-executive-report">
    <header><div><span>APPLIED COMMERCE® · BIS OUTCOMES CLOUD</span><h2>Executive Outcome Report</h2><p>{report.organisation.name} · {report.cohort.name}</p></div><div><small>Generated</small><strong>{formatDate(report.generatedAt)}</strong><small>{report.schemaVersion}</small></div></header>
    <section className="report-summary">
      <div><small>Active learners</small><strong>{report.executiveSummary.activeLearners}</strong></div>
      <div><small>Engagement</small><strong>{report.executiveSummary.engagementRate}%</strong></div>
      <div><small>Completion</small><strong>{report.executiveSummary.completionRate}%</strong></div>
      <div><small>Evidence rows</small><strong>{report.executiveSummary.evidenceRows}</strong></div>
    </section>
    <section><h3>Lab findings</h3>{report.labs.map((lab) => <div className="report-finding" key={lab.cartridgeId}><strong>{lab.title.replace(/ v3\.0$/, "")}</strong><p>{lab.narrative}</p></div>)}</section>
    <section><h3>Operational actions</h3><ol>{report.operationalActions.map((action) => <li key={action}>{action}</li>)}</ol></section>
    <footer><strong>Evidence boundary</strong><p>{report.evidenceBoundary.statement}</p><p>{report.evidenceBoundary.privacy}</p></footer>
  </article>;
}
