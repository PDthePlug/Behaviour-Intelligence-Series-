import { Check, Sparkles } from "lucide-react";

export function BimsMark({ progress = 0, size = "medium" }: { progress?: number; size?: "small" | "medium" | "large" }) {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const complete = safeProgress >= 1;
  return (
    <span className={`bims-mark ${size} ${complete ? "complete" : ""}`} style={{ "--bims-progress": `${safeProgress * 100}%` } as React.CSSProperties} aria-label={`Habit Lab progress ${Math.round(safeProgress * 100)}%`}>
      <span className="bims-mark-fill" />
      {complete ? <Check aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
    </span>
  );
}

