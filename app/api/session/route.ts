import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { learnerProfiles } from "@/db/schema";
import { clearSessionCookie, createSessionId, sessionCookie, sessionFromRequest } from "@/lib/session";

export async function GET(request: Request) {
  const existing = sessionFromRequest(request);
  if (existing) return Response.json({ session: "ready" });

  const id = createSessionId();
  return Response.json(
    { session: "created" },
    { headers: { "Set-Cookie": sessionCookie(id), "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const sessionId = sessionFromRequest(request);

  try {
    if (sessionId) {
      const db = getDb();
      await db
        .update(learnerProfiles)
        .set({ sessionId: `signed-out:${crypto.randomUUID()}`, updatedAt: Date.now() })
        .where(eq(learnerProfiles.sessionId, sessionId));
    }

    return Response.json(
      { signedOut: true },
      { headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("BIS sign out failed", error);
    return Response.json(
      { error: "You could not be signed out. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
