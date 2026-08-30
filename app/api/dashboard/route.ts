import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { labComponentResponses, learnerProfiles, partnershipInquiries } from "@/db/schema";
import { publishedLabs } from "@/lib/lab-catalog";

export async function GET() {
  const db = getDb();
  const [responseCount, completeCount, learnerCount, enquiryCount] = await Promise.all([
    db.select({ count: count() }).from(labComponentResponses),
    db.select({ count: count() }).from(labComponentResponses).where(eq(labComponentResponses.isComplete, true)),
    db.select({ count: count() }).from(learnerProfiles),
    db.select({ count: count() }).from(partnershipInquiries),
  ]);

  const interactionsCaptured = Number(responseCount[0]?.count ?? 0);
  const completedInteractions = Number(completeCount[0]?.count ?? 0);
  const learners = Number(learnerCount[0]?.count ?? 0);
  const completionSignalRate = interactionsCaptured
    ? Math.round((completedInteractions / interactionsCaptured) * 100)
    : 0;

  return Response.json({
    platform: {
      learnerProfiles: learners,
      interactionsCaptured,
      completedInteractions,
      completionSignalRate,
      publishedCartridges: publishedLabs.length,
      partnershipInterest: Number(enquiryCount[0]?.count ?? 0),
      status: interactionsCaptured > 0 ? "Learner activity present" : "Awaiting learner activity",
    },
    safeguards: [
      "This endpoint is platform telemetry, not an institutional cohort report.",
      "Private learner writing is never included in this view.",
      "No hard-coded Lab denominator is used; cohort completion is calculated only by the institutional dashboard endpoint.",
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
