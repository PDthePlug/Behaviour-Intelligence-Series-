import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labComponentResponses, learnerProfiles, partnershipInquiries } from "@/db/schema";
import { habitLab } from "@/lib/habit-lab";

export async function GET() {
  const db = getDb();
  const [responseCount, completeCount, learnerCount, enquiryCount] = await Promise.all([
    db.select({ count: count() }).from(labComponentResponses),
    db.select({ count: count() }).from(labComponentResponses).where(eq(labComponentResponses.isComplete, true)),
    db.select({ count: count() }).from(learnerProfiles),
    db.select({ count: count() }).from(partnershipInquiries),
  ]);

  const liveResponses = Number(responseCount[0]?.count ?? 0);
  const completed = Number(completeCount[0]?.count ?? 0);
  const learners = Number(learnerCount[0]?.count ?? 0);
  const totalPossible = Math.max(learners, 1) * 55;
  return Response.json({
    cohort: {
      activeLearners: learners,
      reflectionsCaptured: liveResponses,
      completedLabSteps: Math.round((completed / totalPossible) * 100),
      partnershipInterest: Number(enquiryCount[0]?.count ?? 0),
      status: liveResponses > 0 ? `${habitLab.title} activity` : "Awaiting learner activity",
    },
    safeguards: ["Private learner writing is never included in this view.", "Only cohort-level participation signals are shown.", "No labels, diagnoses or automated learner profiles."],
  }, { headers: { "Cache-Control": "no-store" } });
}
