import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { learnerProgress, learnerReflections } from "@/db/schema";
import { labBySlug } from "@/lib/bis-content";
import { sessionFromRequest } from "@/lib/session";

type ReflectionPayload = {
  labSlug?: string;
  stepKey?: string;
  response?: string;
  completedSteps?: number;
};

function failure(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const sessionId = sessionFromRequest(request);
  if (!sessionId) return Response.json({ reflections: [], progress: [] });

  const db = getDb();
  const [reflections, progress] = await Promise.all([
    db.select().from(learnerReflections).where(eq(learnerReflections.sessionId, sessionId)).orderBy(desc(learnerReflections.createdAt)).limit(18),
    db.select().from(learnerProgress).where(eq(learnerProgress.sessionId, sessionId)),
  ]);
  return Response.json({ reflections, progress }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const sessionId = sessionFromRequest(request);
  if (!sessionId) return failure("Your private preview session has not started. Refresh and try again.", 401);

  const body = (await request.json()) as ReflectionPayload;
  const lab = body.labSlug ? labBySlug(body.labSlug) : undefined;
  const response = body.response?.trim() ?? "";
  const completedSteps = Math.min(Math.max(Number(body.completedSteps) || 0, 0), 9);
  if (!lab) return failure("Please select a valid lab.");
  if (response.length < 12 || response.length > 4000) return failure("A reflection needs between 12 and 4,000 characters.");

  const db = getDb();
  const now = Date.now();
  const stepKey = body.stepKey?.slice(0, 120) || "reflection";
  await db.batch([
    db.insert(learnerReflections).values({
      id: crypto.randomUUID(),
      sessionId,
      labSlug: lab.slug,
      stepKey,
      prompt: lab.prompt,
      response,
      isPrivate: true,
      createdAt: now,
    }),
    db.insert(learnerProgress).values({
      id: crypto.randomUUID(),
      sessionId,
      labSlug: lab.slug,
      completedSteps,
      lastStep: stepKey,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [learnerProgress.sessionId, learnerProgress.labSlug],
      set: { completedSteps, lastStep: stepKey, updatedAt: now },
    }),
  ]);

  return Response.json({ saved: true, progress: { labSlug: lab.slug, completedSteps, lastStep: stepKey, updatedAt: now } }, { status: 201 });
}
