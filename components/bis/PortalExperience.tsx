"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CalendarDays,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock3,
  Compass,
  Eye,
  FlaskConical,
  Focus,
  Globe2,
  Home,
  Library,
  LockKeyhole,
  LogIn,
  LogOut,
  Map,
  Moon,
  MoreHorizontal,
  PiggyBank,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  SunMedium,
  User,
  UserRoundPlus,
  Wifi,
} from "lucide-react";
import { habitLab, type LabCartridge, type LabStep, type ReflectionProps } from "@/lib/habit-lab";
import { labById, labComponents, publishedLabs } from "@/lib/lab-catalog";
import { readApiResponse } from "@/lib/api-response";
import { BimsMark } from "./BimsMark";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { LabPlayer } from "./LabPlayer";
import { LearnerProfile, ResponseMap, SaveComponent, SavedResponse } from "./types";

type EntryStage = "loading" | "cold" | "welcome" | "pattern" | "login" | "register" | "shell";
type Room = "marketplace" | "today" | "lab" | "journey" | "profile";

const patterns = [
  { name: "Phone & Screen Habits", line: "The reach happens before the decision.", icon: Smartphone },
  { name: "Procrastination", line: "The task waits. The feeling arrives first.", icon: Clock3 },
  { name: "Focus & Distraction", line: "Attention leaves clues when it moves.", icon: Focus },
  { name: "Spending Habits", line: "Money often follows a moment, not a plan.", icon: PiggyBank },
  { name: "Sleep Patterns", line: "The night carries what the day did not finish.", icon: Moon },
  { name: "Something Else", line: "Name the pattern in your own words.", icon: MoreHorizontal },
];

type CatalogueLab = {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  difficulty: string;
  duration: string;
  steps: number;
  description: string;
  outcome: string;
  status: "available" | "preparing";
  accent: string;
};

const catalogueLabs: CatalogueLab[] = [
  {
    id: "habit-lab-2026",
    title: "Habit Lab™: Self-Mastery Basics v3.0",
    shortTitle: "Habit Lab™",
    category: "Behaviour & Self-Regulation",
    difficulty: "Observe",
    duration: "90 mins / 7 days",
    steps: 11,
    description: "Train the pause between a behavioural trigger and your response, then test a practical seven-day self-mastery experiment.",
    outcome: "Build a personal trigger-to-payoff map",
    status: "available",
    accent: "amber",
  },
  {
    id: "decision-lab-2026",
    title: "Decision Lab™: Seeing Hidden Options v3.0",
    shortTitle: "Decision Lab™",
    category: "Behaviour & Self-Regulation",
    difficulty: "Analyse",
    duration: "90 mins / 7 days",
    steps: 11,
    description: "Uncover hidden options, build personal decision equations and create a cognitive pause under social pressure.",
    outcome: "See the third option beneath obvious choices",
    status: "available",
    accent: "blue",
  },
  {
    id: "identity-lab",
    title: "Identity Lab™: Identity as a Verb v3.0",
    shortTitle: "Identity Lab™",
    category: "Personal Growth",
    difficulty: "Identity Shift",
    duration: "90 mins / 7 days",
    steps: 10,
    description: "Move from inherited scripts to intentional self-authorship by auditing influence, belief and personal alignment.",
    outcome: "Turn identity into intentional daily evidence",
    status: "preparing",
    accent: "violet",
  },
  {
    id: "innovation-lab",
    title: "Innovation Thinking™ Lab: Process over Inspiration v3.0",
    shortTitle: "Innovation Thinking™",
    category: "Applied Thinking",
    difficulty: "Identity Shift",
    duration: "90 mins / 7 days",
    steps: 11,
    description: "Use systematic experimentation, curiosity loops and iterative evidence to transform failure into functional innovation.",
    outcome: "Replace inspiration pressure with a repeatable process",
    status: "preparing",
    accent: "blue",
  },
  {
    id: "money-lab",
    title: "Money Lab™: The Emotional Object v3.0",
    shortTitle: "Money Lab™",
    category: "Financial Literacy",
    difficulty: "Observe",
    duration: "90 mins / 7 days",
    steps: 10,
    description: "Trace the emotions beneath spending, formulate a personal money equation and practise a 24-hour cooling rule.",
    outcome: "Recognise emotional triggers before spending",
    status: "preparing",
    accent: "rose",
  },
];

const catalogueCategories = [
  "All",
  "Behaviour & Self-Regulation",
  "Financial Literacy",
  "Applied Thinking",
  "Personal Growth",
];

const roomDetails: Record<Room, { name: string; subtitle: string }> = {
  marketplace: { name: "Behaviour Marketplace", subtitle: "Storefront & learner library" },
  journey: { name: "Journey", subtitle: "Your active Lab milestones" },
  lab: { name: "Labs", subtitle: "Guided reflection room" },
  today: { name: "Today", subtitle: "Your next reflection" },
  profile: { name: "Profile", subtitle: "Private learner identity" },
};

const roomNav: Array<{ room: Room; label: string; icon: typeof Home }> = [
  { room: "marketplace", label: "Marketplace", icon: ShoppingBag },
  { room: "journey", label: "Journey", icon: Map },
  { room: "lab", label: "Labs", icon: FlaskConical },
  { room: "today", label: "Today", icon: Home },
  { room: "profile", label: "Profile", icon: User },
];

function asResponseMap(responses: SavedResponse[]) {
  return responses.reduce<ResponseMap>((map, response) => {
    map[response.componentId] = response;
    return map;
  }, {});
}

function answersFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("answers" in payload)) return [];
  return Object.values((payload as { answers: Record<string, string | number> }).answers).map(String).filter(Boolean);
}

type ResponseSets = Record<string, ResponseMap>;

function responsesForLab(responseSets: ResponseSets, lab: LabCartridge): ResponseMap {
  return responseSets[lab.cartridgeId] ?? {};
}

function progressForLab(lab: LabCartridge, responses: ResponseMap) {
  const components = labComponents(lab);
  const completed = components.filter((component) => responses[component.id]?.isComplete).length;
  return { components, completed, progress: components.length ? completed / components.length : 0 };
}

function currentStepForLab(lab: LabCartridge, responses: ResponseMap): LabStep {
  const steps = lab.timeline.steps;
  const firstIncomplete = steps.find((step) => !step.components.every((component) => responses[component.id]?.isComplete));
  return firstIncomplete ?? steps[steps.length - 1];
}

export function PortalExperience() {
  const [entryStage, setEntryStage] = useState<EntryStage>("loading");
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [selectedPattern, setSelectedPattern] = useState("Focus & Distraction");
  const [room, setRoom] = useState<Room>("today");
  const [activeLabId, setActiveLabId] = useState(habitLab.cartridgeId);
  const [responseSets, setResponseSets] = useState<ResponseSets>({});
  const [requestedStepId, setRequestedStepId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [loadingLab, setLoadingLab] = useState(false);

  const loadLabs = useCallback(async () => {
    setLoadingLab(true);
    try {
      const loaded = await Promise.all(publishedLabs.map(async (lab) => {
        const response = await fetch(`/api/lab?cartridgeId=${encodeURIComponent(lab.cartridgeId)}`, { credentials: "include", cache: "no-store" });
        if (!response.ok) return [lab.cartridgeId, {}] as const;
        const data = await response.json() as { responses: SavedResponse[] };
        return [lab.cartridgeId, asResponseMap(data.responses)] as const;
      }));
      setResponseSets(Object.fromEntries(loaded));
    } finally {
      setLoadingLab(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialise() {
      try {
        await fetch("/api/session", { credentials: "include", cache: "no-store" });
        const response = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
        const data = response.ok ? await response.json() as { profile: LearnerProfile | null } : { profile: null };
        if (!active) return;
        if (data.profile) {
          setProfile(data.profile);
          setSelectedPattern(data.profile.selectedPattern);
          setEntryStage("shell");
          await loadLabs();
        } else {
          setEntryStage("cold");
        }
      } catch {
        if (active) setEntryStage("cold");
      }
    }
    void initialise();
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      active = false;
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, [loadLabs]);

  useEffect(() => {
    if (entryStage !== "cold") return;
    const timer = window.setTimeout(() => setEntryStage("welcome"), 6200);
    return () => window.clearTimeout(timer);
  }, [entryStage]);

  const saveComponent: SaveComponent = useCallback(async (stepId, componentId, payload, isComplete) => {
    const response = await fetch("/api/lab", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartridgeId: activeLabId, stepId, componentId, payload, isComplete }),
    });
    const data = await response.json() as { error?: string; updatedAt?: number };
    if (!response.ok) throw new Error(data.error ?? "The interaction could not be saved.");
    setResponseSets((current) => ({
      ...current,
      [activeLabId]: {
        ...(current[activeLabId] ?? {}),
        [componentId]: { stepId, componentId, payload, isComplete, updatedAt: data.updatedAt ?? Date.now() },
      },
    }));
  }, [activeLabId]);

  const activeLab = labById(activeLabId) ?? habitLab;
  const responses = responsesForLab(responseSets, activeLab);
  const { components: activeComponents, completed: completedComponents, progress } = useMemo(() => progressForLab(activeLab, responses), [activeLab, responses]);
  const currentStep = currentStepForLab(activeLab, responses);

  const openLab = useCallback((cartridgeId: string, stepId?: string) => {
    const nextLab = labById(cartridgeId);
    if (!nextLab) return;
    const nextResponses = responsesForLab(responseSets, nextLab);
    setActiveLabId(nextLab.cartridgeId);
    setRequestedStepId(stepId ?? currentStepForLab(nextLab, nextResponses).id);
    setRoom("lab");
  }, [responseSets]);

  const leaveProfile = useCallback(() => {
    setProfile(null);
    setResponseSets({});
    setRequestedStepId(null);
    setSelectedPattern("Focus & Distraction");
    setRoom("today");
    setEntryStage("login");
  }, []);

  if (entryStage === "loading") return <div className="quiet-loading"><BimsMark progress={0.08} size="large" /><span>Opening your private space…</span></div>;
  if (entryStage === "cold") return <ColdLaunch onSkip={() => setEntryStage("welcome")} />;
  if (entryStage === "welcome") return <Welcome onBegin={() => setEntryStage("pattern")} onReturning={() => setEntryStage("login")} />;
  if (entryStage === "pattern") return <PatternPicker selected={selectedPattern} onSelect={setSelectedPattern} onContinue={() => setEntryStage("register")} onBack={() => setEntryStage("welcome")} />;
  if (entryStage === "login") return <AuthPanel mode="login" selectedPattern={selectedPattern} onBack={() => setEntryStage("welcome")} onAuthenticated={(nextProfile) => { setProfile(nextProfile); setSelectedPattern(nextProfile.selectedPattern); setEntryStage("shell"); void loadLabs(); }} onSwitch={() => setEntryStage("register")} />;
  if (entryStage === "register") return <AuthPanel mode="register" selectedPattern={selectedPattern} onBack={() => setEntryStage("pattern")} onAuthenticated={(nextProfile) => { setProfile(nextProfile); setEntryStage("shell"); void loadLabs(); }} onSwitch={() => setEntryStage("login")} />;

  return (
    <div className={`quiet-shell room-${room} profile-${profile?.profileStyle ?? "quiet"} lab-${activeLab.cartridgeId}`}>
      {!online && <div className="offline-banner">You’re offline. Keep reflecting; reconnect before saving the next interaction.</div>}
      <header className="quiet-desktop-header">
        <div className="room-identity"><BimsMark progress={progress} size="small" /><div><strong>{roomDetails[room].name}</strong><span>{roomDetails[room].subtitle}</span></div></div>
        <nav aria-label="Learner rooms">{roomNav.map((item) => { const Icon = item.icon; return <button key={item.room} className={room === item.room ? "active" : ""} onClick={() => setRoom(item.room)}><Icon size={15} />{item.label}</button>; })}</nav>
        <div className="environment-status"><span><SunMedium size={14} /> Warm paper</span><span><ShieldCheck size={14} /> Private vault</span></div>
      </header>

      <div className="quiet-mobile-room"><div className="room-identity"><BimsMark progress={progress} size="small" /><div><strong>{roomDetails[room].name}</strong><span>{roomDetails[room].subtitle}</span></div></div><span>{Math.round(progress * 100)}%</span></div>

      <div className="quiet-environment">
        <main className="quiet-workspace">
          {room === "marketplace" && <MarketplaceRoom responseSets={responseSets} onOpenLab={openLab} />}
          {room === "today" && <TodayDesk profile={profile} lab={activeLab} currentStep={currentStep} responses={responses} progress={progress} loadingLab={loadingLab} online={online} onOpenLab={() => openLab(activeLab.cartridgeId, currentStep.id)} onOpenJourney={() => setRoom("journey")} onChangeLab={(cartridgeId) => { setActiveLabId(cartridgeId); setRequestedStepId(null); }} />}
          {room === "lab" && <LabPlayer key={activeLab.cartridgeId} lab={activeLab} responses={responses} onSave={saveComponent} requestedStepId={requestedStepId} onStepChange={setRequestedStepId} onReturnToDesk={() => setRoom("today")} />}
          {room === "journey" && <JourneyMap lab={activeLab} responses={responses} activeStepId={currentStep.id} onOpen={(stepId) => openLab(activeLab.cartridgeId, stepId)} />}
          {room === "profile" && profile && <IdentityDesk profile={profile} activeLab={activeLab} responseSets={responseSets} onProfileUpdated={(nextProfile) => { setProfile(nextProfile); setSelectedPattern(nextProfile.selectedPattern); }} onLogout={leaveProfile} />}
        </main>

        <aside className="quiet-observation-panel">
          <div className="observation-heading"><Sparkles size={14} /><span>Quiet observation</span></div>
          <div className="observation-block"><small>Current pattern</small><strong>{profile?.selectedPattern ?? selectedPattern}</strong><p>The Lab is gathering evidence from what you notice—not assigning you a label.</p></div>
          <div className="observation-block"><small>Journey rhythm</small><strong>{completedComponents < 5 ? "Beginning slowly" : completedComponents < 25 ? "Evidence is gathering" : "Understanding is deepening"}</strong><div className="observation-track"><i style={{ width: `${progress * 100}%` }} /></div><span>{completedComponents} of {activeComponents.length} interactions complete</span></div>
          {completedComponents >= 12 && completedComponents % 4 === 0 ? <blockquote>“You are starting to describe the pattern with more precision.”</blockquote> : <div className="intentional-silence"><Eye size={16} /><span>Nothing needs to be said yet.<br />The system is still listening.</span></div>}
        </aside>
      </div>

      <nav className="quiet-bottom-nav" aria-label="Learner rooms">{roomNav.map((item) => { const Icon = item.icon; return <button key={item.room} className={room === item.room ? "active" : ""} onClick={() => setRoom(item.room)}><Icon size={21} /><span>{item.label}</span></button>; })}</nav>
    </div>
  );
}

function ColdLaunch({ onSkip }: { onSkip: () => void }) {
  return (
    <button className="cold-launch" onClick={onSkip} aria-label="Skip opening sequence">
      <div className="cold-symbol"><BimsMark progress={0.16} size="large" /></div>
      <div className="cold-lines"><p>Every habit tells a story.</p><p>Let&apos;s discover yours.</p></div>
      <span>Tap anywhere to begin</span>
    </button>
  );
}

function Welcome({ onBegin, onReturning }: { onBegin: () => void; onReturning: () => void }) {
  return (
    <main className="quiet-lobby">
      <div className="lobby-mark"><BimsMark progress={0.04} size="medium" /><div><strong>Behaviour Intelligence System®</strong><span>Applied Commerce®</span></div></div>
      <section className="lobby-card">
        <span className="privacy-pill"><LockKeyhole size={13} /> Private learner space</span>
        <h1>Understand the patterns<br />that shape your day.</h1>
        <p>A quiet place to notice your habits, decisions and daily routines—then test what helps you move differently.</p>
        <button className="lobby-primary" onClick={onBegin}>Begin reflection <ArrowRight size={17} /></button>
        <button className="lobby-secondary" onClick={onReturning}><LogIn size={15} /> I&apos;ve been here before</button>
        <div className="lobby-trust"><ShieldCheck size={15} /><span>Your reflections are private. Your institution sees participation, never your words.</span></div>
      </section>
      <p className="lobby-footnote">Behaviour comes before results.</p>
    </main>
  );
}

function PatternPicker({ selected, onSelect, onContinue, onBack }: { selected: string; onSelect: (value: string) => void; onContinue: () => void; onBack: () => void }) {
  const selectedPattern = patterns.find((pattern) => pattern.name === selected);
  return (
    <main className="pattern-lobby">
      <button className="entry-back" onClick={onBack}>← Back</button>
      <div className="pattern-heading"><span>START WITH YOUR LIFE</span><h1>What pattern would you<br />like to explore?</h1><p>There is no right answer. Choose the one that feels most present today.</p></div>
      <div className="pattern-grid">{patterns.map((pattern) => { const Icon = pattern.icon; return <button key={pattern.name} className={selected === pattern.name ? "selected" : ""} onClick={() => onSelect(pattern.name)}><Icon size={20} /><strong>{pattern.name}</strong><span>{pattern.line}</span>{selected === pattern.name && <Check size={15} />}</button>; })}</div>
      <div className="pattern-selection"><div><small>YOU CHOSE</small><strong>{selectedPattern?.name}</strong><p>{selectedPattern?.line}</p></div><button onClick={onContinue}>Continue <ArrowRight size={17} /></button></div>
    </main>
  );
}

function AuthPanel({ mode, selectedPattern, onBack, onAuthenticated, onSwitch }: { mode: "login" | "register"; selectedPattern: string; onBack: () => void; onAuthenticated: (profile: LearnerProfile) => void; onSwitch: () => void }) {
  const [form, setForm] = useState({ firstName: "", surname: "", email: "", passcode: "", country: "South Africa", profileStyle: "quiet" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, ...form, selectedPattern }),
      });
      const data = await readApiResponse<{ profile?: LearnerProfile; error?: string }>(response, "Your learner profile could not be opened. Please try again.");
      if (!data.profile) throw new Error("Your learner profile could not be opened. Please try again.");
      onAuthenticated(data.profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your profile could not be opened.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-lobby">
      <button className="entry-back" onClick={onBack}>← Back</button>
      <div className="auth-watermark"><BimsMark progress={0.08} size="large" /></div>
      <section className="auth-card">
        <div className="auth-brand"><BimsMark progress={0.06} size="small" /><span>APPLIED COMMERCE®</span></div>
        <h1>Behaviour Intelligence System®</h1>
        <p>Understand Yourself. Build Better Habits.</p>
        <div className="auth-divider" />
        <h2>{mode === "login" ? "Welcome back" : "Create your private profile"}</h2>
        <span className="auth-subtitle">{mode === "login" ? "Continue your Habit Lab where you left it." : `You’re beginning with ${selectedPattern}.`}</span>
        <GoogleSignInButton selectedPattern={selectedPattern} profileStyle={form.profileStyle} country={form.country} onAuthenticated={onAuthenticated} onError={setError} />
        <form onSubmit={submit}>
          {mode === "register" && <div className="auth-name-grid"><label>First name<input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label>Surname<input required value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></label></div>}
          <label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>{mode === "login" ? "Passcode" : "Choose a passcode"}<input required type="password" minLength={4} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.passcode} onChange={(event) => setForm({ ...form, passcode: event.target.value })} /></label>
          {mode === "register" && <><label>Country<input required value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label><fieldset><legend>How should this space feel?</legend><div className="profile-style-picker">{[["quiet", "Quiet"], ["curious", "Curious"], ["focused", "Focused"]].map(([value, label]) => <button type="button" className={form.profileStyle === value ? "selected" : ""} key={value} onClick={() => setForm({ ...form, profileStyle: value })}><Circle size={11} />{label}</button>)}</div></fieldset></>}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-submit" disabled={submitting} type="submit">{submitting ? "Opening your space…" : mode === "login" ? "Sign in" : "Enter BIS"} <ArrowRight size={16} /></button>
        </form>
        <button className="auth-switch" onClick={onSwitch}>{mode === "login" ? <><UserRoundPlus size={14} /> Create an account</> : <><LogIn size={14} /> I already have a profile</>}</button>
        <div className="auth-privacy"><LockKeyhole size={13} /> Private profile · reflection writing is never shown in cohort reports</div>
      </section>
    </main>
  );
}

function TodayDesk({ profile, lab, currentStep, responses, progress, loadingLab, online, onOpenLab, onOpenJourney, onChangeLab }: { profile: LearnerProfile | null; lab: LabCartridge; currentStep: LabStep; responses: ResponseMap; progress: number; loadingLab: boolean; online: boolean; onOpenLab: () => void; onOpenJourney: () => void; onChangeLab: (cartridgeId: string) => void }) {
  const completedInStep = currentStep.components.filter((component) => responses[component.id]?.isComplete).length;
  const reflectionDepth = Math.min(completedInStep + 1, currentStep.components.length);
  const rhythm = progress === 0 ? "Beginning" : progress < .45 ? "Gathering evidence" : progress < 1 ? "Deepening" : "Complete";
  const shortLabTitle = lab.title.split(":")[0];
  return (
    <section className="today-desk">
      <header className="today-welcome">
        <div><span>TODAY&apos;S REFLECTION</span><h1>Hi, {profile?.firstName ?? "learner"}</h1></div>
        <p className={online ? "synced" : "offline"}><Wifi size={16} /> {online ? "ONLINE & SYNCED" : "OFFLINE"}</p>
      </header>

      <div className="today-lab-switcher"><span>ACTIVE LAB</span><div>{publishedLabs.map((candidate) => <button key={candidate.cartridgeId} className={candidate.cartridgeId === lab.cartridgeId ? "active" : ""} onClick={() => onChangeLab(candidate.cartridgeId)}>{candidate.title.split(":")[0]}<small>{candidate.cartridgeId === lab.cartridgeId ? "Current" : "Open"}</small></button>)}</div></div>

      <article className="habit-story-card">
        <div className="habit-story-copy">
          <div className="habit-story-topline"><span>YOUR REFLECTION STORY</span><em>Your understanding is growing.</em></div>
          <h2>{lab.title}</h2>
          <p>{lab.description}</p>
          <div className="habit-story-footer"><span><BookOpen size={18} /> {currentStep.title}</span><em>{rhythm}</em></div>
        </div>
      </article>

      <div className="today-section-heading"><h2>Today&apos;s focus</h2><span>{currentStep.difficulty}</span></div>
      <article className="today-focus-card">
        <div>
          <small>REFLECTION DEPTH: {reflectionDepth} / {currentStep.components.length}</small>
          <h3>{currentStep.title}</h3>
          <p>{completedInStep === 0 ? "Your next reflection step is ready. Begin when you have a quiet moment." : `${completedInStep} interactions are complete. Continue from the next evidence point.`}</p>
          <button onClick={onOpenLab}>{loadingLab ? "Loading…" : progress === 0 ? "Begin reflection" : "Continue reflection"} <ChevronRight size={17} /></button>
        </div>
        <div className="focus-orbit" aria-label={`${Math.round(progress * 100)} percent complete`}><BimsMark progress={Math.max(progress, .04)} size="medium" /></div>
      </article>

      <div className="today-map-strip"><div><Map size={19} /><span><strong>Your {shortLabTitle} Map</strong>{Math.round(progress * 100)}% of the full Lab complete</span></div><button onClick={onOpenJourney}>See all {lab.timeline.steps.length} milestones <ArrowRight size={16} /></button></div>
      <div className="single-lab-note"><LockKeyhole size={16} /><span><strong>Two Labs. One Behaviour Story.</strong> Habit Lab and Decision Lab keep separate evidence while contributing to the same private learner journey.</span></div>
    </section>
  );
}

function MarketplaceRoom({ responseSets, onOpenLab }: { responseSets: ResponseSets; onOpenLab: (cartridgeId: string) => void }) {
  const [view, setView] = useState<"storefront" | "library">("storefront");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const habitResponses = responsesForLab(responseSets, habitLab);
  const habitStats = progressForLab(habitLab, habitResponses);
  const action = habitStats.progress === 0 ? "Start journey" : habitStats.progress === 1 ? "Review journey" : "Resume journey";
  const normalisedQuery = query.trim().toLowerCase();
  const catalogueResults = catalogueLabs.slice(1).filter((lab) => {
    const matchesCategory = category === "All" || lab.category === category;
    const searchText = `${lab.title} ${lab.category} ${lab.description} ${lab.outcome}`.toLowerCase();
    return matchesCategory && (!normalisedQuery || searchText.includes(normalisedQuery));
  });

  return (
    <section className="marketplace-room">
      <header className="marketplace-store-header">
        <div className="marketplace-brand"><span className="marketplace-brand-mark"><ShoppingBag size={23} /></span><div><small>BMDP™ STORE</small><h1>Behaviour Marketplace</h1></div><em>Live</em></div>
        <div className="marketplace-tabs" role="tablist" aria-label="Marketplace views">
          <button className={view === "storefront" ? "active" : ""} onClick={() => setView("storefront")} role="tab" aria-selected={view === "storefront"}>Storefront</button>
          <button className={view === "library" ? "active" : ""} onClick={() => setView("library")} role="tab" aria-selected={view === "library"}>My Library <span>{publishedLabs.length}</span></button>
        </div>
      </header>

      {view === "storefront" ? (
        <>
          <div className="marketplace-results marketplace-featured-zone">
            <div className="marketplace-section-title"><div><span>FEATURED NOW</span><h2>Your next behaviour experience</h2></div><p>One complete Lab, published with deliberate depth.</p></div>
            <article className="marketplace-feature">
              <div className="marketplace-feature-copy">
                <div className="marketplace-kicker"><span><Sparkles size={13} /> Featured Lab release</span><em><ShieldCheck size={13} /> Canonical Volume 1</em></div>
                <small>BEHAVIOUR &amp; SELF-REGULATION</small>
                <h2>{habitLab.title}</h2>
                <p>Investigate one repeating pattern, map the trigger-to-payoff loop, and design a seven-day behaviour experiment grounded in your own evidence.</p>
                <div className="marketplace-outcomes"><span><CircleCheck size={17} /> Notice the cue, response and payoff beneath a habit</span><span><CircleCheck size={17} /> Build a practical seven-day self-mastery experiment</span></div>
                <div className="marketplace-meta"><span><strong>9</strong> investigations</span><span><strong>55</strong> interactions</span><span><strong>7</strong> experiment days</span></div>
                <div className="marketplace-enrol"><div><small>ACCESS</small><strong>Included with your profile</strong></div><button onClick={() => onOpenLab(habitLab.cartridgeId)}>{action} <ArrowRight size={18} /></button></div>
              </div>
              <div className="marketplace-cover" aria-label="Habit Lab progress">
                <BimsMark progress={Math.max(habitStats.progress, 0.04)} size="large" />
                <div><small>YOUR PROGRESS</small><strong>{Math.round(habitStats.progress * 100)}%</strong><span>{habitStats.completed} of {habitStats.components.length} complete</span></div>
              </div>
            </article>
          </div>

          <section className="catalogue-zone" aria-labelledby="catalogue-title">
            <div className="catalogue-heading">
              <div><span>THE BIS LAB CATALOGUE</span><h2 id="catalogue-title">More ways to investigate behaviour.</h2><p>Decision Lab is now fully digital and available. Every published cartridge becomes part of the same continuous Behaviour Story.</p></div>
              <strong>1 new · 3 upcoming</strong>
            </div>
            <div className="marketplace-tools">
              <label><Search size={17} /><input aria-label="Search the Behaviour Marketplace" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search upcoming Labs" /></label>
              <div className="marketplace-categories" role="group" aria-label="Filter Labs by category">
                {catalogueCategories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
            </div>

            {catalogueResults.length ? (
              <div className="catalogue-grid">
                {catalogueResults.map((lab) => {
                  const runtimeLab = labById(lab.id);
                  const labResponses = runtimeLab ? responsesForLab(responseSets, runtimeLab) : {};
                  const stats = runtimeLab ? progressForLab(runtimeLab, labResponses) : null;
                  const labAction = !stats || stats.progress === 0 ? "Start Decision Lab" : stats.progress === 1 ? "Review Decision Lab" : "Resume Decision Lab";
                  return (
                  <article className={`catalogue-card accent-${lab.accent} ${lab.status === "available" ? "available" : ""}`} key={lab.id}>
                    <div className="catalogue-card-top"><span>{lab.category}</span><em>{lab.status === "available" ? "Available now" : "In preparation"}</em></div>
                    <div className="catalogue-card-mark"><FlaskConical size={23} /></div>
                    <h3>{lab.title}</h3>
                    <p>{lab.description}</p>
                    <div className="catalogue-outcome"><Compass size={17} /><span><small>YOU WILL PRACTISE</small>{lab.outcome}</span></div>
                    <div className="catalogue-card-meta"><span><Clock3 size={14} /> {lab.duration}</span><span><Map size={14} /> {lab.steps} milestones</span><span>{lab.difficulty}</span></div>
                    {lab.status === "available" && runtimeLab ? <button className="catalogue-start" onClick={() => onOpenLab(runtimeLab.cartridgeId)}>{labAction} <ArrowRight size={16} /></button> : <button disabled aria-label={`${lab.shortTitle} is coming soon`}>Coming soon <ArrowRight size={16} /></button>}
                  </article>
                  );
                })}
              </div>
            ) : (
              <div className="marketplace-empty"><Search size={24} /><h2>No upcoming Lab matches those filters.</h2><p>Try another category or clear the search.</p><button onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button></div>
            )}
          </section>

          <div className="marketplace-roadmap"><div><LockKeyhole size={16} /><span><strong>The catalogue grows deliberately.</strong> Upcoming cartridges become available only after their source workbooks are completely digitalised and quality assured.</span></div><em>2 live · 3 preparing</em></div>
        </>
      ) : (
        <div className="marketplace-library">
          <div className="marketplace-library-summary"><div><Library size={20} /><span>MY LEARNER LIBRARY</span></div><strong>{publishedLabs.length}</strong><small>cartridges available</small></div>
          {publishedLabs.map((lab) => {
            const labResponses = responsesForLab(responseSets, lab);
            const stats = progressForLab(lab, labResponses);
            const reflectionCount = stats.components.filter((component) => component.type === "PrivateReflection" && labResponses[component.id]?.isComplete).length;
            const labAction = stats.progress === 0 ? "Start journey" : stats.progress === 1 ? "Review journey" : "Resume journey";
            return <article className={`marketplace-library-card library-${lab.cartridgeId}`} key={lab.cartridgeId}><div className="marketplace-library-mark"><BimsMark progress={Math.max(stats.progress, 0.04)} size="medium" /></div><div className="marketplace-library-copy"><small>VOLUME 1 · VERSION {lab.version}</small><h2>{lab.title}</h2><p>Behaviour &amp; self-regulation · Private learner journey</p><div className="marketplace-library-progress"><i style={{ width: `${stats.progress * 100}%` }} /></div><span>{stats.completed} of {stats.components.length} interactions · {reflectionCount} private reflections</span></div><button onClick={() => onOpenLab(lab.cartridgeId)}>{labAction} <ChevronRight size={16} /></button></article>;
          })}
          <p className="marketplace-access"><ShieldCheck size={14} /> Included with your BIS learner access. Your saved work remains in your private reflection vault.</p>
          <PrivateLibrary responseSets={responseSets} />
        </div>
      )}
    </section>
  );
}

function JourneyMap({ lab, responses, activeStepId, onOpen }: { lab: LabCartridge; responses: ResponseMap; activeStepId: string; onOpen: (stepId: string) => void }) {
  const steps = lab.timeline.steps;
  const components = labComponents(lab);
  return (
    <section className="journey-room">
      <header><span>{lab.title.split(":")[0].toUpperCase()} MAP</span><h1>Your investigation,<br />one page turn at a time.</h1><p>The map shows all {steps.length} section milestones. Inside them, {components.length} source-faithful interactions are revealed progressively.</p></header>
      <div className="journey-list">{steps.map((step, index) => { const complete = step.components.every((component) => responses[component.id]?.isComplete); const previousComplete = index === 0 || steps[index - 1].components.every((component) => responses[component.id]?.isComplete); const unlocked = complete || previousComplete || step.id === activeStepId; const componentCount = step.components.filter((component) => responses[component.id]?.isComplete).length; return <article className={`${complete ? "complete" : step.id === activeStepId ? "current" : unlocked ? "open" : "locked"}`} key={step.id}><div className="journey-node">{complete ? <CircleCheck size={21} /> : unlocked ? <span>{index + 1}</span> : <LockKeyhole size={15} />}</div><div><small>{step.difficulty} · {step.components.length} interactions</small><h2>{step.title}</h2><p>{componentCount}/{step.components.length} complete</p></div><button disabled={!unlocked} onClick={() => onOpen(step.id)}>{complete ? "Review" : step.id === activeStepId ? "Continue" : unlocked ? "Open" : "Locked"}</button></article>; })}</div>
    </section>
  );
}

function PrivateLibrary({ responseSets }: { responseSets: ResponseSets }) {
  const entries = publishedLabs.flatMap((lab) => {
    const responses = responsesForLab(responseSets, lab);
    return lab.timeline.steps.flatMap((step) => step.components.filter((component) => component.type === "PrivateReflection").map((component) => ({ lab, step, component, response: responses[component.id] }))).filter((entry) => entry.response);
  });
  return (
    <section className="library-room">
      <header><span>PRIVATE LIBRARY</span><h1>Your words remain yours.</h1><p>Saved reflections from every published Lab appear here. They are grouped by investigation and never appear in the institution-facing cohort view.</p></header>
      {entries.length === 0 ? <div className="empty-library"><BookOpen size={27} /><h2>Your first page is still blank.</h2><p>Private reflections will appear here after you begin Habit Lab or Decision Lab.</p></div> : <div className="library-entries">{entries.map(({ lab, step, component, response }) => { const props = component.props as ReflectionProps; const answers = answersFromPayload(response.payload); return <details key={`${lab.cartridgeId}:${component.id}`}><summary><div><small>{lab.title.split(":")[0]} · {step.title}</small><strong>{props.prompt.split("\n").find(Boolean)?.replace(/[🔎⭐✍️]/g, "").trim()}</strong></div><span>{new Date(response.updatedAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}</span></summary><div className="library-entry-body">{answers.map((answer, index) => <blockquote key={`${answer}-${index}`}>{answer}</blockquote>)}</div></details>; })}</div>}
    </section>
  );
}

function IdentityDesk({ profile, activeLab, responseSets, onProfileUpdated, onLogout }: { profile: LearnerProfile; activeLab: LabCartridge; responseSets: ResponseSets; onProfileUpdated: (profile: LearnerProfile) => void; onLogout: () => void }) {
  const [form, setForm] = useState({
    firstName: profile.firstName,
    surname: profile.surname,
    country: profile.country,
    selectedPattern: profile.selectedPattern,
    profileStyle: profile.profileStyle,
  });
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const activeResponses = responsesForLab(responseSets, activeLab);
  const activeStats = progressForLab(activeLab, activeResponses);
  const completedSteps = activeLab.timeline.steps.filter((step) => step.components.every((component) => activeResponses[component.id]?.isComplete)).length;
  const privateReflections = publishedLabs.reduce((total, lab) => {
    const labResponses = responsesForLab(responseSets, lab);
    return total + labComponents(lab).filter((component) => component.type === "PrivateReflection" && labResponses[component.id]?.isComplete).length;
  }, 0);
  const evidence = activeLab.beiSchema.map((indicator) => {
    const component = activeStats.components.find((candidate) => candidate.beiTarget === indicator.code);
    return { indicator, response: component ? activeResponses[component.id] : undefined };
  });

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...form }),
      });
      const data = await readApiResponse<{ profile?: LearnerProfile; error?: string }>(response, "Your profile changes could not be saved.");
      if (!data.profile) throw new Error("Your profile changes could not be saved.");
      onProfileUpdated(data.profile);
      setNotice("Profile changes saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your profile changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/session", { method: "DELETE", credentials: "include", cache: "no-store" });
      const data = await readApiResponse<{ signedOut?: boolean; error?: string }>(response, "You could not be signed out.");
      if (!data.signedOut) throw new Error("You could not be signed out.");
      onLogout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "You could not be signed out.");
      setSigningOut(false);
    }
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
  const providerLabel = profile.authProvider === "google" ? "Google account" : "Email & passcode";
  const initials = `${profile.firstName[0] ?? ""}${profile.surname[0] ?? ""}`;

  return (
    <section className="identity-room">
      <header className="identity-hero"><div><span>YOUR BIS PROFILE</span><h1>Your learning space,<br />under your control.</h1><p>Manage your identity, reflection preferences and account without leaving your private learner environment.</p></div><div className="identity-member-state"><ShieldCheck size={18} /><span><strong>Active member</strong>Private learner profile</span></div></header>

      <div className="identity-profile">
        <div className={`identity-avatar ${profile.avatarUrl ? "has-image" : ""}`} style={profile.avatarUrl ? { backgroundImage: `url(${profile.avatarUrl})` } : undefined}>{profile.avatarUrl ? <span className="sr-only">{profile.firstName} {profile.surname}</span> : initials}</div>
        <div className="identity-profile-copy"><small>{providerLabel.toUpperCase()}</small><h2>{profile.firstName} {profile.surname}</h2><p>{profile.email}</p><div><span><Globe2 size={13} /> {profile.country}</span><span><CalendarDays size={13} /> Member since {memberSince}</span></div></div>
        <div className="identity-progress-mark"><BimsMark progress={Math.max(activeStats.progress, .04)} size="medium" /><strong>{Math.round(activeStats.progress * 100)}%</strong><span>{activeLab.title.split(":")[0]}</span></div>
      </div>

      <div className="identity-metrics"><article><small>ACTIVE LAB PROGRESS</small><strong>{Math.round(activeStats.progress * 100)}%</strong><span>{activeStats.completed}/{activeStats.components.length} interactions</span></article><article><small>MILESTONES</small><strong>{completedSteps}</strong><span>of {activeLab.timeline.steps.length} completed</span></article><article><small>PRIVATE REFLECTIONS</small><strong>{privateReflections}</strong><span>across your learner Library</span></article></div>

      <div className="profile-control-grid">
        <form className="profile-settings-card" onSubmit={saveProfile}>
          <div className="profile-card-heading"><div><Settings2 size={18} /><span><small>PROFILE SETTINGS</small><h2>Personal details</h2></span></div><p>Keep the details attached to your learner profile current.</p></div>
          <div className="profile-form-grid"><label>First name<input required minLength={2} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label>Surname<input required minLength={2} value={form.surname} onChange={(event) => setForm({ ...form, surname: event.target.value })} /></label><label className="profile-email-field">Email address<input readOnly value={profile.email} /><small>Your sign-in email is managed by your {providerLabel.toLowerCase()}.</small></label><label>Country<input required minLength={2} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label></div>

          <div className="profile-preference-block"><div><small>CURRENT FOCUS</small><h3>What pattern are you exploring?</h3></div><select value={form.selectedPattern} onChange={(event) => setForm({ ...form, selectedPattern: event.target.value })}>{patterns.map((pattern) => <option key={pattern.name} value={pattern.name}>{pattern.name}</option>)}</select></div>

          <fieldset className="profile-atmosphere"><legend>How should this space feel?</legend><div>{[["quiet", "Quiet", "A softer, low-noise canvas"], ["curious", "Curious", "A little more visual energy"], ["focused", "Focused", "Sharper contrast and direction"]].map(([value, label, description]) => <button type="button" className={form.profileStyle === value ? "active" : ""} key={value} onClick={() => setForm({ ...form, profileStyle: value })}><span><Circle size={11} />{label}</span><small>{description}</small></button>)}</div></fieldset>

          {(notice || error) && <p className={error ? "profile-form-message error" : "profile-form-message success"}>{error || notice}</p>}
          <button className="profile-save-button" disabled={saving} type="submit"><Save size={16} /> {saving ? "Saving changes…" : "Save profile changes"}</button>
        </form>

        <aside className="profile-account-column">
          <article className="profile-privacy-card"><div><ShieldCheck size={21} /><span><small>PRIVACY</small><h2>Your reflections remain private.</h2></span></div><p>Your institution can see participation signals, never the words inside your private reflections.</p><ul><li><Check size={14} /> Reflection writing stays in your learner vault</li><li><Check size={14} /> Your profile uses a private browser session</li><li><Check size={14} /> Behaviour evidence avoids identity labels</li></ul></article>
          <article className="profile-account-card"><div><LogIn size={19} /><span><small>ACCOUNT &amp; SESSION</small><h2>{providerLabel}</h2></span></div><dl><div><dt>Account email</dt><dd>{profile.email}</dd></div><div><dt>Member since</dt><dd>{memberSince}</dd></div><div><dt>Session</dt><dd><span className="session-dot" /> Active &amp; secure</dd></div></dl><button className="profile-logout-button" type="button" disabled={signingOut} onClick={signOut}><LogOut size={16} /> {signingOut ? "Signing out…" : "Log out of BIS"}</button><p>Logging out ends this browser session. Your saved Lab progress remains available when you sign in again.</p></article>
        </aside>
      </div>

      <div className="evidence-ledger"><div><span>{activeLab.title.split(":")[0].toUpperCase()} · BEHAVIOUR EVIDENCE INDICATORS</span><small>Recorded quietly as the active Lab unfolds</small></div>{evidence.map(({ indicator, response }) => <article key={indicator.code}><span className={response?.isComplete ? "captured" : ""}>{response?.isComplete ? <Check size={13} /> : <Circle size={10} />}</span><div><strong>{indicator.code}</strong><p>{indicator.description}</p></div><em>{response?.isComplete ? "Captured" : "Not reached"}</em></article>)}</div>
    </section>
  );
}
