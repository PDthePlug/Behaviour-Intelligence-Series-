"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, LockKeyhole, Pause, Play, RotateCcw, ShieldCheck, Wind } from "lucide-react";
import {
  BreathProps,
  ChecklistProps,
  DailyEvidenceTrackerProps,
  LabComponent,
  LikertProps,
  parseWorkbookPrompt,
  ReflectionProps,
  StoryNarrativeProps,
} from "@/lib/habit-lab";
import { SaveComponent, SavedResponse } from "./types";

type RendererProps = {
  stepId: string;
  component: LabComponent;
  saved?: SavedResponse;
  onSave: SaveComponent;
};

type TrackerDay = {
  date: string;
  action?: string;
  done: boolean | null;
  notes: string;
};

function InlineText({ text }: { text: string }) {
  const pieces = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return <>{pieces.map((piece, index) => piece.startsWith("**") && piece.endsWith("**") ? <strong key={`${piece}-${index}`}>{piece.slice(2, -2)}</strong> : <span key={`${piece}-${index}`}>{piece}</span>)}</>;
}

function MarkdownCopy({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="workbook-copy">
      {blocks.map((block, index) => {
        if (block === "---") return <hr key={index} />;
        if (block.startsWith("### ")) return <h3 key={index}><InlineText text={block.slice(4)} /></h3>;
        const lines = block.split("\n").filter(Boolean);
        if (lines.every((line) => /^[●•-]\s*/.test(line))) {
          return <ul key={index}>{lines.map((line) => <li key={line}><InlineText text={line.replace(/^[●•-]\s*/, "")} /></li>)}</ul>;
        }
        return <p key={index}>{lines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}><InlineText text={line} />{lineIndex < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

function StoryNarrative({ stepId, component, saved, onSave }: RendererProps) {
  const props = component.props as StoryNarrativeProps;
  const savedPayload = saved?.payload as { selectedIndex?: number } | undefined;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(savedPayload?.selectedIndex ?? null);
  const [saving, setSaving] = useState(false);
  const pivots = props.pivots ?? [];

  async function select(index: number) {
    setSelectedIndex(index);
    setSaving(true);
    try {
      await onSave(stepId, component.id, { selectedIndex: index, beiScore: pivots[index]?.beiScore ?? 5 }, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lab-interaction story-interaction">
      <div className="interaction-label"><BookOpen size={14} /><span>Read</span>{saved?.isComplete && <em><Check size={12} /> Complete</em>}</div>
      <article className="narrative-paper">
        <BookOpen className="narrative-watermark" aria-hidden="true" />
        <MarkdownCopy markdown={props.markdown} />
      </article>
      <div className={pivots.length > 5 ? "pivot-grid scale" : "pivot-grid"}>
        {pivots.map((pivot, index) => (
          <button key={`${pivot.text}-${index}`} disabled={saving} className={selectedIndex === index ? "pivot-choice selected" : "pivot-choice"} onClick={() => select(index)}>
            <span>{selectedIndex === index && <Check size={13} />}</span>
            <b>{pivot.text}</b>
          </button>
        ))}
        {pivots.length === 0 && <button disabled={saving} className="pivot-choice continue" onClick={() => select(-1)}><span><Check size={13} /></span><b>Continue</b></button>}
      </div>
    </section>
  );
}

function PrivateReflection({ stepId, component, saved, onSave }: RendererProps) {
  const props = component.props as ReflectionProps;
  const parsed = useMemo(() => parseWorkbookPrompt(props.prompt), [props.prompt]);
  const savedAnswers = ((saved?.payload as { answers?: Record<string, string> } | undefined)?.answers ?? {});
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const firstUnanswered = parsed.items.findIndex((item) => !(savedAnswers[item.id] ?? "").trim());
  const [activeIndex, setActiveIndex] = useState(firstUnanswered === -1 ? Math.max(parsed.items.length - 1, 0) : firstUnanswered);

  function changeAnswer(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setSaveError("");
  }

  async function commit(index: number) {
    const item = parsed.items[index];
    if (!item || !(answers[item.id] ?? "").trim()) {
      setSaveError("Give this question an honest response before continuing.");
      return;
    }
    const complete = parsed.items.every((question) => (answers[question.id] ?? "").trim().length > 0);
    setSaving(true);
    setSaveError("");
    try {
      await onSave(stepId, component.id, { answers }, complete);
      if (index < parsed.items.length - 1) setActiveIndex(index + 1);
    } catch {
      setSaveError("Your reflection could not be saved. Try once more.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lab-interaction reflection-interaction">
      <div className="interaction-label"><LockKeyhole size={14} /><span>{parsed.isStructured ? "Guided reflection" : "Private reflection"}</span><em className={saved?.isComplete ? "saved" : ""}><ShieldCheck size={12} /> {saved?.isComplete ? "Saved safely" : "Private to you"}</em></div>
      {parsed.title && <div className="reflection-title">{parsed.title}</div>}
      <div className="reflection-sequence">
        {parsed.items.map((item, index) => {
          if (index > activeIndex) return null;
          const answered = (answers[item.id] ?? "").trim().length > 0;
          const committed = index < activeIndex || (saved?.isComplete && answered);
          return (
            <div className={committed ? "reflection-question committed" : "reflection-question"} key={item.id}>
              {item.header && !committed && <p className="question-context">{item.header}</p>}
              <label htmlFor={`${component.id}-${item.id}`}>{item.label}</label>
              {committed ? <blockquote>{answers[item.id]}</blockquote> : item.rows === 1 ? (
                <input id={`${component.id}-${item.id}`} value={answers[item.id] ?? ""} onChange={(event) => changeAnswer(item.id, event.target.value)} placeholder={props.placeholder || item.placeholder} />
              ) : (
                <textarea id={`${component.id}-${item.id}`} rows={item.rows} value={answers[item.id] ?? ""} onChange={(event) => changeAnswer(item.id, event.target.value)} placeholder={props.placeholder || item.placeholder} />
              )}
              {!committed && <button className="reflection-commit" disabled={saving || !answered} onClick={() => commit(index)}>{saving ? "Saving…" : index === parsed.items.length - 1 ? "Save reflection" : "Save and reveal next"}</button>}
            </div>
          );
        })}
      </div>
      {saveError && <p className="interaction-error">{saveError}</p>}
    </section>
  );
}

function LikertMatrix({ stepId, component, saved, onSave }: RendererProps) {
  const props = component.props as LikertProps;
  const savedAnswers = ((saved?.payload as { answers?: Record<string, number> } | undefined)?.answers ?? {});
  const [answers, setAnswers] = useState<Record<string, number>>(savedAnswers);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const answeredCount = Object.keys(answers).length;

  async function choose(itemIndex: number, score: number) {
    const nextAnswers: Record<string, number> = { ...answers, [String(itemIndex)]: score };
    setAnswers(nextAnswers);
    setSavingIndex(itemIndex);
    const complete = props.items.every((_, index) => nextAnswers[String(index)] !== undefined);
    try {
      await onSave(stepId, component.id, { answers: nextAnswers }, complete);
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <section className="lab-interaction matrix-interaction">
      <div className="interaction-label"><span>Behaviour evidence scale</span><em className={answeredCount === props.items.length ? "saved" : ""}>{answeredCount}/{props.items.length}</em></div>
      <h3>{props.question}</h3>
      <div className="matrix-progress"><i style={{ width: `${(answeredCount / Math.max(props.items.length, 1)) * 100}%` }} /></div>
      <div className="matrix-items">
        {props.items.map((item, itemIndex) => (
          <article key={item}>
            <small>Indicator {String(itemIndex + 1).padStart(2, "0")}</small>
            <p>{item}</p>
            <div className="matrix-options">
              {[1, 2, 3, 4, 5].map((score) => <button key={score} disabled={savingIndex === itemIndex} className={answers[itemIndex] === score ? "selected" : ""} onClick={() => choose(itemIndex, score)}><b>{score}</b><span>{props.labels[score - 1]}</span></button>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CheckboxInventory({ stepId, component, saved, onSave }: RendererProps) {
  const props = component.props as ChecklistProps;
  const prior = (saved?.payload as { selectedItems?: number[] } | undefined)?.selectedItems ?? [];
  const [selected, setSelected] = useState<Set<number>>(() => new Set(prior));
  const [saving, setSaving] = useState(false);

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function save() {
    const selectedItems = Array.from(selected).sort((a, b) => a - b);
    setSaving(true);
    try {
      await onSave(stepId, component.id, {
        selectedItems,
        selectedLabels: selectedItems.map((index) => props.items[index]).filter(Boolean),
      }, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lab-interaction matrix-interaction">
      <div className="interaction-label"><span>Behaviour evidence inventory</span><em className={saved?.isComplete ? "saved" : ""}>{saved?.isComplete ? "Saved" : "Select all that apply"}</em></div>
      <h3>{props.question}</h3>
      <div className="pivot-grid">
        {props.items.map((item, index) => (
          <button key={item} type="button" className={selected.has(index) ? "pivot-choice selected" : "pivot-choice"} onClick={() => toggle(index)}>
            <span>{selected.has(index) && <Check size={13} />}</span><b>{item}</b>
          </button>
        ))}
      </div>
      <button className="reflection-commit" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save risk inventory"}</button>
    </section>
  );
}

function longestDoneStreak(days: TrackerDay[]) {
  let longest = 0;
  let current = 0;
  for (const day of days) {
    if (day.done === true) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function DailyEvidenceTracker({ stepId, component, saved, onSave }: RendererProps) {
  const props = component.props as DailyEvidenceTrackerProps;
  const savedDays = (saved?.payload as { days?: TrackerDay[] } | undefined)?.days ?? [];
  const [days, setDays] = useState<TrackerDay[]>(() => Array.from({ length: props.days }, (_, index) => ({
    date: savedDays[index]?.date ?? "",
    action: savedDays[index]?.action ?? "",
    done: savedDays[index]?.done ?? null,
    notes: savedDays[index]?.notes ?? "",
  })));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const daysCompleted = days.filter((day) => day.done === true).length;
  const trackedDays = days.filter((day) => day.done !== null).length;
  const consecutiveDays = longestDoneStreak(days);
  const isComplete = days.every((day) => day.date.trim() && day.done !== null && (!props.actionLabel || (day.action ?? "").trim()));

  function updateDay(index: number, patch: Partial<TrackerDay>) {
    setDays((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day));
    setSaveError("");
  }

  async function saveProgress() {
    setSaving(true);
    setSaveError("");
    try {
      await onSave(stepId, component.id, { days, daysCompleted, consecutiveDays }, isComplete);
    } catch {
      setSaveError("Your tracker could not be saved. Try once more.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="lab-interaction matrix-interaction">
      <div className="interaction-label"><span>7-day evidence tracker</span><em className={isComplete ? "saved" : ""}>{trackedDays}/{props.days} days recorded</em></div>
      <h3>{props.question}</h3>
      <div className="matrix-progress"><i style={{ width: `${(trackedDays / Math.max(props.days, 1)) * 100}%` }} /></div>
      <div className="matrix-items">
        {days.map((day, index) => (
          <article key={`day-${index + 1}`}>
            <small>Day {index + 1}</small>
            <div className="reflection-question">
              <label htmlFor={`${component.id}-date-${index}`}>Date</label>
              <input id={`${component.id}-date-${index}`} type="date" value={day.date} onChange={(event) => updateDay(index, { date: event.target.value })} />
              {props.actionLabel && <><label htmlFor={`${component.id}-action-${index}`}>{props.actionLabel}</label><input id={`${component.id}-action-${index}`} value={day.action ?? ""} onChange={(event) => updateDay(index, { action: event.target.value })} placeholder={`Record today's ${props.actionLabel.toLowerCase()}…`} /></>}
              <label>Did I do it?</label>
              <div className="matrix-options">
                <button type="button" className={day.done === true ? "selected" : ""} onClick={() => updateDay(index, { done: true })}><b><Check size={14} /></b><span>{props.doneLabel}</span></button>
                <button type="button" className={day.done === false ? "selected" : ""} onClick={() => updateDay(index, { done: false })}><b>×</b><span>{props.notDoneLabel}</span></button>
              </div>
              <label htmlFor={`${component.id}-notes-${index}`}>{props.notesLabel}</label>
              <textarea id={`${component.id}-notes-${index}`} rows={2} value={day.notes} onChange={(event) => updateDay(index, { notes: event.target.value })} placeholder="What helped or got in the way?" />
            </div>
          </article>
        ))}
      </div>
      <div className="reflection-title">BEI-06: Days Completed: {daysCompleted} / {props.days}<br />Consecutive Days: {consecutiveDays} / {props.days}</div>
      <button className="reflection-commit" disabled={saving} onClick={saveProgress}>{saving ? "Saving…" : isComplete ? "Save completed experiment" : "Save tracker progress"}</button>
      {saveError && <p className="interaction-error">{saveError}</p>}
    </section>
  );
}

function MindfulBreath({ stepId, component, saved, onSave }: RendererProps) {
  const props = component.props as BreathProps;
  const total = (props.inhaleSeconds + props.holdSeconds + props.exhaleSeconds) * props.cycles;
  const alreadyComplete = Boolean((saved?.payload as { completed?: boolean } | undefined)?.completed || saved?.isComplete);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(alreadyComplete ? total : 0);
  const savedRef = useRef(alreadyComplete);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= total) {
          window.clearInterval(timer);
          setPlaying(false);
          if (!savedRef.current) {
            savedRef.current = true;
            void onSave(stepId, component.id, { completed: true, durationSeconds: total }, true);
          }
          return total;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, total, stepId, component.id, onSave]);

  const cycleLength = props.inhaleSeconds + props.holdSeconds + props.exhaleSeconds;
  const withinCycle = elapsed % cycleLength;
  const cycle = Math.min(props.cycles, Math.floor(elapsed / cycleLength) + 1);
  const complete = elapsed >= total;
  const phase = complete ? "Complete" : withinCycle < props.inhaleSeconds ? "Inhale" : withinCycle < props.inhaleSeconds + props.holdSeconds ? "Hold" : "Exhale";
  const secondsLeft = Math.max(0, total - elapsed);

  return (
    <section className="lab-interaction breath-interaction">
      <div className="interaction-label"><Wind size={14} /><span>Intentional pause</span><em>{complete ? "Complete" : `${secondsLeft}s remaining`}</em></div>
      <div className={playing ? `breath-orbit ${phase.toLowerCase()}` : complete ? "breath-orbit complete" : "breath-orbit"}>
        <div><small>{complete ? "Pause" : `Cycle ${cycle} of ${props.cycles}`}</small><strong>{phase}</strong></div>
      </div>
      <p className="breath-prompt">{props.prompt}</p>
      {!complete && <div className="breath-controls"><button onClick={() => { setPlaying(false); setElapsed(0); }} aria-label="Restart pause"><RotateCcw size={18} /></button><button className="play" onClick={() => setPlaying((current) => !current)}>{playing ? <Pause size={21} /> : <Play size={21} />}</button></div>}
      {complete && <p className="pause-complete"><Check size={15} /> Pause completed. Continue when you are ready.</p>}
    </section>
  );
}

export function LabComponentRenderer(props: RendererProps) {
  if (props.component.type === "StoryNarrative") return <StoryNarrative {...props} />;
  if (props.component.type === "PrivateReflection") return <PrivateReflection {...props} />;
  if (props.component.type === "LikertMatrix") return <LikertMatrix {...props} />;
  if (props.component.type === "CheckboxInventory") return <CheckboxInventory {...props} />;
  if (props.component.type === "DailyEvidenceTracker") return <DailyEvidenceTracker {...props} />;
  return <MindfulBreath {...props} />;
}
