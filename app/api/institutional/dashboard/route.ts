import { institutionalAdminFailure } from "@/lib/institutional-auth";
import { buildCohortOutcome } from "@/lib/institutional-outcomes";

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const denied = await institutionalAdminFailure(request);
  if (denied) return denied;

  const cohortId = new URL(request.url).searchParams.get("cohortId")?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");

  const outcome = await buildCohortOutcome(cohortId);
  if (!outcome) return fail("That cohort does not exist.", 404);

  return Response.json(outcome, { headers: { "Cache-Control": "no-store" } });
}
