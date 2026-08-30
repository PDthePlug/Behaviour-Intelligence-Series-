"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck, Users } from "lucide-react";

type Enrolment = {
  label: string;
  organisation: { id: string; name: string };
  cohort: { id: string; name: string };
  requireLearnerConsent: boolean;
  expiresAt: number | null;
  labs: Array<{ cartridgeId: string; title: string; status: string; startsAt: number | null; dueAt: number | null }>;
  privacyStatement: string;
};
type LearnerProfile = { firstName: string; surname: string; email: string };

export function JoinExperience() {
  const [token, setToken] = useState("");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [consent, setConsent] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nextToken = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(nextToken);
    if (!nextToken) { setError("This learner invitation is incomplete."); setLoading(false); return; }
    Promise.all([
      fetch(`/api/enrolment?token=${encodeURIComponent(nextToken)}`, { credentials: "include", cache: "no-store" }).then(async (response) => {
        const data = await response.json() as { enrolment?: Enrolment; error?: string };
        if (!response.ok || !data.enrolment) throw new Error(data.error ?? "This learner invitation cannot be opened.");
        return data.enrolment;
      }),
      fetch("/api/profile", { credentials: "include", cache: "no-store" }).then(async (response) => {
        const data = response.ok ? await response.json() as { profile: LearnerProfile | null } : { profile: null };
        return data.profile;
      }),
    ]).then(([invitation, learner]) => { setEnrolment(invitation); setProfile(learner); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "This learner invitation cannot be opened."))
      .finally(() => setLoading(false));
  }, []);

  async function join() {
    if (!profile || !enrolment) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/enrolment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consentGranted: enrolment.requireLearnerConsent ? consent : true }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "You could not join this cohort.");
      setJoined(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "You could not join this cohort."); }
    finally { setLoading(false); }
  }

  if (loading && !enrolment) return <main className="self-shell"><div className="self-loading">Opening learner invitation…</div></main>;
  if (error && !enrolment) return <main className="self-shell"><section className="self-join-card"><ShieldCheck size={25} /><h1>Invitation unavailable</h1><div className="self-error">{error}</div></section></main>;
  if (!enrolment) return null;

  return <main className="self-shell"><section className="self-join-card"><ShieldCheck size={25} /><small>BIS LEARNER INVITATION</small><h1>{enrolment.cohort.name}</h1><p><strong>{enrolment.organisation.name}</strong> has invited you to join this BIS cohort.</p><div className="self-join-labs">{enrolment.labs.map((lab) => <span key={lab.cartridgeId}><Users size={13} /> {lab.title.replace(/ v3\.0$/, "")} · {lab.status}</span>)}</div><div className="self-consent"><p>{enrolment.privacyStatement}</p>{enrolment.requireLearnerConsent && <label><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I agree to participate in this cohort and allow BIS to share permitted participation and governed programme evidence with this institution. My private reflection words remain private.</span></label>}</div>{joined ? <><div className="self-notice"><Check size={15} /> You have joined {enrolment.cohort.name}.</div><div className="self-join-actions"><a href="/portal">Open my BIS learner space</a></div></> : profile ? <><p>Signed in as <strong>{profile.firstName} {profile.surname}</strong> ({profile.email}).</p><div className="self-join-actions"><button disabled={loading || (enrolment.requireLearnerConsent && !consent)} onClick={() => void join()}>{loading ? "Joining…" : "Join cohort"}</button><a className="quiet" href="/portal">Open learner profile</a></div></> : <><p>You need an active BIS learner profile before this invitation can be claimed. Sign in or create your profile, then return to this invitation link.</p><div className="self-join-actions"><a href="/portal">Open BIS learner portal</a></div></>}{error && <div className="self-error">{error}</div>}</section></main>;
}
