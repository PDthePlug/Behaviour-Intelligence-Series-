"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FlaskConical, LockKeyhole, Sparkles, X } from "lucide-react";
import type { LabCartridge } from "@/lib/habit-lab";
import { labComponents } from "@/lib/lab-catalog";
import { BimsMark } from "./BimsMark";
import { LabComponentRenderer } from "./LabComponents";
import { ResponseMap, SaveComponent } from "./types";

type LabPlayerProps = {
  lab: LabCartridge;
  responses: ResponseMap;
  onSave: SaveComponent;
  requestedStepId?: string | null;
  onStepChange?: (stepId: string) => void;
  onReturnToDesk: () => void;
};

export function LabPlayer({ lab, responses, onSave, requestedStepId, onStepChange, onReturnToDesk }: LabPlayerProps) {
  const steps = lab.timeline.steps;
  const components = useMemo(() => labComponents(lab), [lab]);
  const completedStepIds = useMemo(() => steps.filter((step) => step.components.every((component) => responses[component.id]?.isComplete)).map((step) => step.id), [responses, steps]);
  const firstIncompleteIndex = steps.findIndex((step) => !completedStepIds.includes(step.id));
  const defaultIndex = firstIncompleteIndex === -1 ? steps.length - 1 : firstIncompleteIndex;
  const requestedIndex = requestedStepId ? steps.findIndex((step) => step.id === requestedStepId) : -1;
  const [activeIndex, setActiveIndex] = useState(requestedIndex >= 0 ? requestedIndex : defaultIndex);
  const [transitioning, setTransitioning] = useState(false);
  const activeStep = steps[activeIndex];
  const completedComponents = components.filter((component) => responses[component.id]?.isComplete).length;
  const globalProgress = completedComponents / components.length;

  useEffect(() => {
    onStepChange?.(activeStep.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep.id, onStepChange]);

  const allComponentsComplete = activeStep.components.every((component) => responses[component.id]?.isComplete);
  const visibleComponents = activeStep.components.filter((_, index) => index === 0 || activeStep.components.slice(0, index).every((component) => responses[component.id]?.isComplete));

  function moveBack() {
    if (activeIndex > 0) setActiveIndex((current) => current - 1);
  }

  function moveForward() {
    if (!allComponentsComplete || transitioning) return;
    if (activeIndex === steps.length - 1) {
      onReturnToDesk();
      return;
    }
    setTransitioning(true);
    window.setTimeout(() => {
      setActiveIndex((current) => Math.min(current + 1, steps.length - 1));
      setTransitioning(false);
    }, 1400);
  }

  if (transitioning) {
    const nextStep = steps[Math.min(activeIndex + 1, steps.length - 1)];
    return (
      <section className="lab-transition">
        <div className="lab-global-progress"><i style={{ width: `${globalProgress * 100}%` }} /></div>
        <header className="lab-room-header">
          <div className="lab-room-title"><BimsMark progress={globalProgress} size="small" /><div><h1>You&apos;re building your understanding.</h1><p>{nextStep.title} <span>•</span> Step {activeIndex + 2} of {steps.length}</p></div></div>
          <button className="lab-exit" onClick={onReturnToDesk} aria-label={`Exit ${lab.title} and return to Today`}><X size={20} /></button>
        </header>
        <div className="lab-transition-message"><span><Sparkles size={24} /></span><p>“Let&apos;s move to the next part of this investigation.”</p><small>You noticed something worth carrying forward.</small></div>
        <footer><Sparkles size={20} /> Reflecting…</footer>
      </section>
    );
  }

  return (
    <div className="reflection-room">
      <div className="lab-global-progress"><i style={{ width: `${globalProgress * 100}%` }} /></div>
      <header className="lab-room-header">
        <div className="lab-room-title">
          <BimsMark progress={globalProgress} size="small" />
          <div>
            <h1>You&apos;re building your understanding.</h1>
            <p>{activeStep.title} <span>•</span> Step {activeIndex + 1} of {steps.length}</p>
          </div>
        </div>
        <div className="lab-header-actions">{activeStep.tensionLevel >= 3 && <span className="deep-reflection"><AlertTriangle size={13} /> Deep reflection</span>}<button className="lab-exit" onClick={onReturnToDesk} aria-label={`Exit ${lab.title} and return to Today`}><X size={20} /></button></div>
      </header>

      <div className="lab-section-map">
        <button onClick={moveBack} disabled={activeIndex === 0}><ArrowLeft size={15} /> Previous</button>
        <div>
          <span>{activeStep.difficulty}</span>
          <b>{visibleComponents.length} of {activeStep.components.length} interactions revealed</b>
        </div>
        <span className="lab-micro-count"><FlaskConical size={14} /> {completedComponents}/{components.length}</span>
      </div>

      <main className="lab-component-stack">
        {visibleComponents.map((component, index) => (
          <div className="lab-component-frame" key={component.id}>
            <div className="component-order"><span>{String(index + 1).padStart(2, "0")}</span><i />{responses[component.id]?.isComplete && <Check size={14} />}</div>
            <LabComponentRenderer stepId={activeStep.id} component={component} saved={responses[component.id]} onSave={onSave} />
          </div>
        ))}
      </main>

      <footer className="lab-save-bar">
        <div><LockKeyhole size={14} /><span>{allComponentsComplete ? "This investigation is complete." : "Complete the interaction above to reveal what comes next."}</span></div>
        <button disabled={!allComponentsComplete} onClick={moveForward}>
          {activeIndex === steps.length - 1 ? "Return to your desk" : "Save & continue"} <ArrowRight size={17} />
        </button>
      </footer>

      {completedStepIds.length === steps.length && <div className="lab-completion-seal"><Sparkles size={16} /><span>{lab.title} complete. Your evidence remains part of your private Behaviour Profile.</span></div>}
    </div>
  );
}
