export type Lab = {
  slug: string;
  number: string;
  title: string;
  focus: string;
  mission: string;
  observer: string;
  prompt: string;
  stepLabel: string;
  status: "available";
};

/**
 * Backwards-compatible metadata for the earlier reflection endpoint.
 * The learner runtime itself is driven by the canonical Habit Lab cartridge.
 */
export const labs: Lab[] = [{
  slug: "habit",
  number: "01",
  title: "Habit Lab™",
  focus: "Self-mastery basics",
  mission: "See the loop beneath one repeating behaviour and design a better next move.",
  observer: "Nobody noticed what Sipho stopped doing that morning.",
  stepLabel: "Evidence challenge",
  prompt: "Open your wallet or bag. What do the last seven days of receipts tell you about one habit that keeps repeating?",
  status: "available",
}];

export const labBySlug = (slug: string) => labs.find((lab) => lab.slug === slug);

