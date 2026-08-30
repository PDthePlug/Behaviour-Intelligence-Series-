"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BarChart3, Check, ClipboardCopy, FileText, FlaskConical, LogOut, Plus, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";

type Role = "owner" | "admin" | "facilitator" | "viewer";
type AuthState = {
  organisation: { id: string | null; name: string };
  user: { id: string | null; email: string; firstName: string | null; surname: string | null; role: Role; controlPlane: boolean };
};
type CohortRecord = {
  id: string;
  name: string;
  status: string;
  organisation: { id: string; name: string; slug: string };
  deployment: { id: string; name: string; status: string; startsAt: number | null; endsAt: number | null };
  updatedAt: number;
};
type Deployment = { id: string; name: string; status: string; startsAt: number | null; endsAt: number | null };
type Assignment = { id: string; cartridgeId: string; title: string; status: string; effectiveStatus: string; startsAt: number | null; dueAt: number | null };
type EnrolmentLink = { id: string; label: string; maxUses: number | null; uses: number; expiresAt: number | null; active: boolean };
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
        indexShift: Shift;
        confidenceShift: Shift;
        predictionCalibration: { withEvidence: number; correctRate: number | null };
        experimentAdherence: { withEvidence: number; denominator: number; averageDaysCompleted: number | null; fullAdherenceLearners: number };
        riskDistribution: { withEvidence: number; categories: Array<{ category: string; learners: number }> };
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
};
type ExecutiveReport = { generatedAt: number; cohort: { id: string; name: string }; organisation: { name: string }; executiveSummary: { activeLearners: number; engagementRate: number; completionRate: number; evidenceRows: number }; evidenceBoundary: { statement: string } };

type StaffUser = { id: string; email: string; firstName: string | null; surname: string | null; role: string; status: string; lastLoginAt: number | null };

const publishedCartridges = [
  { id: "habit-lab-2026", label: "Habit Lab™" },
  { id: "decision-lab-2026", label: "Decision Lab™" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "The institutional request failed.");
  return data;
}

function metric(value: number | null, suffix = "") {
  return value == null ? "—" : `${value}${suffix}`;
}

function dateInputValue(value: number | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function InstitutionalConsole() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [organisationSlug, setOrganisationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [passcode, setPasscode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteSurname, setInviteSurname] = useState("");
  const [invitePasscode, setInvitePasscode] = useState("");

  const [cohorts, setCohorts] = useState<CohortRecord[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [links, setLinks] = useState<EnrolmentLink[]>([]);
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [lastJoinUrl, setLastJoinUrl] = useState("");
  const [lastStaffInviteUrl, setLastStaffInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = auth?.user.role === "owner" || auth?.user.role === "admin";
  const canObserve = canManage || auth?.user.role === "facilitator";
  const canGenerateReport = canManage;
  const selectedCohort = useMemo(() => cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null, [cohorts, selectedCohortId]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite") ?? "";
    setInviteToken(token);
    void api<{ authenticated: boolean; organisation?: AuthState["organisation"]; user?: AuthState["user"] }>("/api/institutional/auth")
      .then((state) => {
        if (state.authenticated && state.organisation && state.user) setAuth({ organisation: state.organisation, user: state.user });
      })
      .catch(() => undefined)
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (auth) void refreshWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user.id, auth?.user.email]);

  useEffect(() => {
    if (auth && selectedCohortId) void loadCohort(selectedCohortId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCohortId]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const state = await api<AuthState & { authenticated: true }>("/api/institutional/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", organisationSlug, email, passcode }),
      });
      setAuth({ organisation: state.organisation, user: state.user });
      setPasscode("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Institutional sign-in failed."); }
    finally { setBusy(false); }
  }

  async function acceptInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const state = await api<AuthState & { authenticated: true }>("/api/institutional/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", inviteToken, firstName: inviteFirstName, surname: inviteSurname, passcode: invitePasscode }),
      });
      history.replaceState({}, "", "/institutional");
      setInviteToken("");
      setAuth({ organisation: state.organisation, user: state.user });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invitation acceptance failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await api("/api/institutional/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }).catch(() => undefined);
    setAuth(null); setCohorts([]); setDeployments([]); setUsers([]); setDashboard(null); setAssignments([]); setLinks([]); setReport(null);
  }

  async function refreshWorkspace() {
    if (!auth) return;
    setBusy(true); setError("");
    try {
      const [cohortData, deploymentData] = await Promise.all([
        api<{ cohorts: CohortRecord[] }>("/api/institutional/cohorts"),
        api<{ deployments: Deployment[] }>("/api/institutional/deployments").catch(() => ({ deployments: [] })),
      ]);
      setCohorts(cohortData.cohorts);
      setDeployments(deploymentData.deployments);
      if (canManage) {
        const staff = await api<{ users: StaffUser[] }>("/api/institutional/users");
        setUsers(staff.users);
      } else setUsers([]);
      const next = selectedCohortId && cohortData.cohorts.some((cohort) => cohort.id === selectedCohortId) ? selectedCohortId : cohortData.cohorts[0]?.id ?? "";
      setSelectedCohortId(next);
      if (next) await loadCohort(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The institutional workspace could not be loaded."); }
    finally { setBusy(false); }
  }

  async function loadCohort(cohortId: string) {
    if (!cohortId) return;
    setError("");
    try {
      const [outcomes, assignmentData, linkData, reportData] = await Promise.all([
        api<Dashboard>(`/api/institutional/dashboard?cohortId=${encodeURIComponent(cohortId)}`),
        api<{ assignments: Assignment[] }>(`/api/institutional/assignments?cohortId=${encodeURIComponent(cohortId)}`),
        api<{ links: EnrolmentLink[] }>(`/api/institutional/enrolment-links?cohortId=${encodeURIComponent(cohortId)}`),
        api<{ reports: Array<{ report: ExecutiveReport | null }> }>(`/api/institutional/reports?cohortId=${encodeURIComponent(cohortId)}`),
      ]);
      setDashboard(outcomes);
      setAssignments(assignmentData.assignments);
      setLinks(linkData.links);
      setReport(reportData.reports[0]?.report ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cohort operations could not be loaded."); }
  }

  async function createEnrolmentLink() {
    if (!selectedCohortId) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ joinPath: string }>("/api/institutional/enrolment-links", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId: selectedCohortId, label: "Cohort learner invitation", requireLearnerConsent: true, maxUses: dashboard?.summary.activeLearners ? Math.max(60, dashboard.summary.activeLearners * 2) : 60 }),
      });
      setLastJoinUrl(`${window.location.origin}${result.joinPath}`);
      await loadCohort(selectedCohortId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Enrolment link could not be created."); }
    finally { setBusy(false); }
  }

  async function generateReport() {
    if (!selectedCohortId) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ report: ExecutiveReport }>("/api/institutional/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cohortId: selectedCohortId }) });
      setReport(result.report);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Outcome report could not be generated."); }
    finally { setBusy(false); }
  }

  if (checkingAuth) return <main className="self-shell"><div className="self-loading">Opening institutional workspace…</div></main>;
  if (!auth) {
    if (inviteToken) {
      return <main className="self-shell"><section className="self-auth-card"><ShieldCheck size={26} /><small>BIS OUTCOMES CLOUD</small><h1>Accept institutional invitation</h1><p>Create your staff identity. Your role and organisation are encoded in the one-time invitation.</p><form onSubmit={acceptInvite}><label>First name<input value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} required /></label><label>Surname<input value={inviteSurname} onChange={(e) => setInviteSurname(e.target.value)} required /></label><label>Institutional passcode<input type="password" minLength={8} value={invitePasscode} onChange={(e) => setInvitePasscode(e.target.value)} required /></label><button disabled={busy}>{busy ? "Activating…" : "Activate account"}</button></form>{error && <div className="self-error">{error}</div>}</section></main>;
    }
    return <main className="self-shell"><section className="self-auth-card"><ShieldCheck size={26} /><small>BIS OUTCOMES CLOUD</small><h1>Institutional sign in</h1><p>Organisation-scoped access for owners, administrators, facilitators and evidence viewers.</p><form onSubmit={login}><label>Organisation code<input value={organisationSlug} onChange={(e) => setOrganisationSlug(e.target.value)} placeholder="example-school" required /></label><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Institutional passcode<input type="password" minLength={8} value={passcode} onChange={(e) => setPasscode(e.target.value)} required /></label><button disabled={busy}>{busy ? "Signing in…" : "Open workspace"}</button></form>{error && <div className="self-error">{error}</div>}</section></main>;
  }

  return <main className="self-shell">
    <header className="self-header"><div><small>BIS OUTCOMES CLOUD</small><h1>{auth.organisation.name}</h1><p>{auth.user.firstName ?? auth.user.email} · {auth.user.role}</p></div><div className="self-header-actions"><button onClick={() => void refreshWorkspace()} disabled={busy}><RefreshCw size={15} />Refresh</button><button onClick={() => void logout()}><LogOut size={15} />Sign out</button></div></header>
    {error && <div className="self-error wide">{error}</div>}
    <section className="self-context"><label>Cohort<select value={selectedCohortId} onChange={(e) => setSelectedCohortId(e.target.value)}>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name} · {cohort.deployment.name}</option>)}</select></label><div><small>Role boundary</small><strong>{auth.user.role}</strong><span>{auth.user.role === "facilitator" ? "Assigned cohorts only" : "Organisation scoped"}</span></div><div><small>Privacy</small><strong>Private reflections excluded</strong><span>Governed aggregate evidence only</span></div></section>

    {dashboard && <>
      <section className="self-metrics"><Metric icon={<Users size={18} />} label="Active learners" value={dashboard.summary.activeLearners} suffix="" /><Metric icon={<BarChart3 size={18} />} label="Engagement" value={dashboard.summary.engagementRate} suffix="%" /><Metric icon={<FlaskConical size={18} />} label="Completion" value={dashboard.summary.completionRate} suffix="%" /><Metric icon={<ShieldCheck size={18} />} label="Evidence rows" value={dashboard.summary.evidenceRows} suffix="" /></section>
      <section className="self-section"><div className="self-section-head"><div><small>PROGRAMME EVIDENCE</small><h2>{dashboard.cohort.name}</h2></div>{canGenerateReport && <button onClick={() => void generateReport()} disabled={busy}><FileText size={15} />Generate executive snapshot</button>}</div><div className="self-lab-grid">{dashboard.labs.map((lab) => <LabCard key={lab.assignmentId} lab={lab} />)}</div>{report && <div className="self-report"><strong>Latest executive snapshot</strong><span>{new Date(report.generatedAt).toLocaleString("en-ZA")}</span><p>{report.evidenceBoundary.statement}</p></div>}</section>
    </>}

    <section className="self-section"><div className="self-section-head"><div><small>DELIVERY OPERATIONS</small><h2>Assignments & learner entry</h2></div>{canObserve && <button onClick={() => void createEnrolmentLink()} disabled={!selectedCohortId || busy}><Plus size={15} />Create learner link</button>}</div><div className="self-assignment-list">{assignments.map((assignment) => <div key={assignment.id}><strong>{assignment.title}</strong><span>{assignment.effectiveStatus}</span><small>{assignment.startsAt ? `Starts ${new Date(assignment.startsAt).toLocaleDateString("en-ZA")}` : "Open now"} · {assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleDateString("en-ZA")}` : "No due date"}</small></div>)}</div>{lastJoinUrl && <CopyBox label="New learner invitation" value={lastJoinUrl} />}{links.length > 0 && <div className="self-link-list">{links.slice(0, 5).map((link) => <span key={link.id}>{link.label} · {link.uses}{link.maxUses ? `/${link.maxUses}` : ""} uses · {link.active ? "active" : "closed"}</span>)}</div>}</section>

    {canManage && <ManagementPanel deployments={deployments} cohorts={cohorts} selectedCohortId={selectedCohortId} users={users} onCreated={() => void refreshWorkspace()} onStaffInvite={(url) => setLastStaffInviteUrl(url)} />}
    {lastStaffInviteUrl && <section className="self-section"><CopyBox label="One-time staff invitation" value={lastStaffInviteUrl} /></section>}
    {canObserve && selectedCohort && <ObservationPanel cohortId={selectedCohort.id} assignments={assignments} onSaved={() => void loadCohort(selectedCohort.id)} />}
  </main>;
}

function Metric({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix: string }) {
  return <article className="self-metric"><div>{icon}<span>{label}</span></div><strong>{value}{suffix}</strong></article>;
}

function LabCard({ lab }: { lab: LabOutcome }) {
  return <article className="self-lab-card"><header><div><small>{lab.cartridgeId}</small><h3>{lab.title.replace(/ v3\.0$/, "")}</h3></div><span>{lab.engagementRate}% engaged</span></header><div className="self-progress"><i style={{ width: `${lab.completionRate}%` }} /></div><p>{lab.completionRate}% interaction completion</p>{lab.outcomes.suppressed ? <div className="self-suppressed"><ShieldCheck size={15} />{lab.outcomes.reason}</div> : <div className="self-evidence"><span><small>Index shift</small><b>{metric(lab.outcomes.indexShift.averageShift)}</b></span><span><small>Confidence shift</small><b>{metric(lab.outcomes.confidenceShift.averageShift)}</b></span><span><small>Experiment</small><b>{metric(lab.outcomes.experimentAdherence.averageDaysCompleted, "/7")}</b></span><span><small>Calibration</small><b>{metric(lab.outcomes.predictionCalibration.correctRate, "%")}</b></span></div>}</article>;
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="self-copy"><div><small>{label}</small><strong>{value}</strong></div><button onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={15} /> : <ClipboardCopy size={15} />}{copied ? "Copied" : "Copy"}</button></div>;
}

function ManagementPanel({ deployments, cohorts, selectedCohortId, users, onCreated, onStaffInvite }: { deployments: Deployment[]; cohorts: CohortRecord[]; selectedCohortId: string; users: StaffUser[]; onCreated: () => void; onStaffInvite: (url: string) => void }) {
  const [deploymentName, setDeploymentName] = useState("");
  const [cohortName, setCohortName] = useState("");
  const [deploymentId, setDeploymentId] = useState(deployments[0]?.id ?? "");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<Role>("facilitator");
  const [cartridgeId, setCartridgeId] = useState(publishedCartridges[0].id);
  const [startsAt, setStartsAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { if (!deploymentId && deployments[0]) setDeploymentId(deployments[0].id); }, [deploymentId, deployments]);

  async function createDeployment(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { await api("/api/institutional/deployments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: deploymentName }) }); setDeploymentName(""); setMessage("Deployment created."); onCreated(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Deployment failed."); }
  }
  async function createCohort(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { await api("/api/institutional/cohorts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deploymentId, name: cohortName }) }); setCohortName(""); setMessage("Cohort created."); onCreated(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Cohort failed."); }
  }
  async function inviteStaff(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { const result = await api<{ invitation: { acceptPath: string } }>("/api/institutional/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: staffEmail, role: staffRole, cohortIds: staffRole === "facilitator" && selectedCohortId ? [selectedCohortId] : [] }) }); setStaffEmail(""); onStaffInvite(`${window.location.origin}${result.invitation.acceptPath}`); setMessage("Staff invitation created."); onCreated(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Staff invitation failed."); }
  }
  async function scheduleLab(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { await api("/api/institutional/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cohortId: selectedCohortId, cartridgeId, startsAt: startsAt ? new Date(startsAt).getTime() : null, dueAt: dueAt ? new Date(dueAt).getTime() : null }) }); setMessage("Lab assignment saved."); onCreated(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Assignment failed."); }
  }

  return <section className="self-section"><div className="self-section-head"><div><small>ADMINISTRATION</small><h2>Institution operations</h2></div><UserPlus size={20} /></div>{message && <div className="self-notice">{message}</div>}<div className="self-admin-grid"><form onSubmit={createDeployment}><h3>New deployment</h3><input value={deploymentName} onChange={(e) => setDeploymentName(e.target.value)} placeholder="2027 Grade 10 programme" required /><button>Create deployment</button></form><form onSubmit={createCohort}><h3>New cohort</h3><select value={deploymentId} onChange={(e) => setDeploymentId(e.target.value)} required>{deployments.map((deployment) => <option key={deployment.id} value={deployment.id}>{deployment.name}</option>)}</select><input value={cohortName} onChange={(e) => setCohortName(e.target.value)} placeholder="Grade 10A" required /><button>Create cohort</button></form><form onSubmit={scheduleLab}><h3>Assign / schedule Lab</h3><select value={cartridgeId} onChange={(e) => setCartridgeId(e.target.value)}>{publishedCartridges.map((lab) => <option key={lab.id} value={lab.id}>{lab.label}</option>)}</select><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /><button disabled={!selectedCohortId}>Save assignment</button></form><form onSubmit={inviteStaff}><h3>Invite staff</h3><input type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="facilitator@school.org" required /><select value={staffRole} onChange={(e) => setStaffRole(e.target.value as Role)}><option value="facilitator">Facilitator</option><option value="viewer">Evidence viewer</option><option value="admin">Administrator</option><option value="owner">Owner</option></select><button>Generate invitation</button></form></div><div className="self-staff-list"><strong>Institution staff</strong>{users.slice(0, 12).map((user) => <span key={user.id}>{user.firstName ?? user.email} {user.surname ?? ""} · {user.role} · {user.status}</span>)}</div></section>;
}

function ObservationPanel({ cohortId, assignments, onSaved }: { cohortId: string; assignments: Assignment[]; onSaved: () => void }) {
  const [learnerEmail, setLearnerEmail] = useState("");
  const [cartridgeId, setCartridgeId] = useState(assignments[0]?.cartridgeId ?? "");
  const [participation, setParticipation] = useState(3);
  const [taskCompletion, setTaskCompletion] = useState(3);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { if (!cartridgeId && assignments[0]) setCartridgeId(assignments[0].cartridgeId); }, [assignments, cartridgeId]);
  async function save(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { await api("/api/institutional/observations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cohortId, learnerEmail, cartridgeId, participation, taskCompletion, notes }) }); setLearnerEmail(""); setNotes(""); setMessage("Observation saved to the governed facilitator record."); onSaved(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Observation could not be saved."); }
  }
  return <section className="self-section"><div className="self-section-head"><div><small>FACILITATOR WORKFLOW</small><h2>Record anchored observation</h2></div><ShieldCheck size={19} /></div><form className="self-observation" onSubmit={save}><label>Learner email<input type="email" value={learnerEmail} onChange={(e) => setLearnerEmail(e.target.value)} required /></label><label>Assigned Lab<select value={cartridgeId} onChange={(e) => setCartridgeId(e.target.value)}>{assignments.map((assignment) => <option key={assignment.id} value={assignment.cartridgeId}>{assignment.title}</option>)}</select></label><label>Participation 1–5<input type="number" min={1} max={5} value={participation} onChange={(e) => setParticipation(Number(e.target.value))} /></label><label>Task completion 1–5<input type="number" min={1} max={5} value={taskCompletion} onChange={(e) => setTaskCompletion(Number(e.target.value))} /></label><label className="wide">Observation note<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observable evidence only; avoid diagnosis or private learner reflection content." /></label><button>Save observation</button></form>{message && <div className="self-notice">{message}</div>}</section>;
}
