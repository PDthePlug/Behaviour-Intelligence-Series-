import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, labAssignments } from "@/db/schema";
import { requireInstitutionalAccess } from "@/lib/institutional-access";
import { labById } from "@/lib/lab-catalog";

type AssignmentPayload = {
  action?: "upsert" | "close";
  cohortId?: string;
  cartridgeId?: string;
  startsAt?: number | null;
  dueAt?: number | null;
};

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function optionalTime(value: unknown) {
  return value == null ? null : Number(value);
}

function effectiveStatus(startsAt: number | null, dueAt: number | null, now: number) {
  if (dueAt && dueAt < now) return "closed";
  if (startsAt && startsAt > now) return "scheduled";
  return "active";
}

export async function GET(request: Request) {
  const cohortId = new URL(request.url).searchParams.get("cohortId")?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");
  const access = await requireInstitutionalAccess(request, "assignments:read", cohortId);
  if (access.response) return access.response;

  const rows = await getDb().select().from(labAssignments).where(eq(labAssignments.cohortId, cohortId));
  const now = Date.now();
  return Response.json({
    assignments: rows.map((row) => ({
      ...row,
      title: labById(row.cartridgeId)?.title ?? row.cartridgeId,
      effectiveStatus: row.status === "closed" ? "closed" : effectiveStatus(row.startsAt, row.dueAt, now),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: AssignmentPayload;
  try {
    body = await request.json() as AssignmentPayload;
  } catch {
    return fail("The Lab assignment request is incomplete.");
  }
  const cohortId = body.cohortId?.trim() ?? "";
  const cartridgeId = body.cartridgeId?.trim() ?? "";
  if (!cohortId) return fail("Select a cohort.");
  if (!labById(cartridgeId)) return fail("Select a published Lab cartridge.");
  const access = await requireInstitutionalAccess(request, "assignments:write", cohortId);
  if (access.response) return access.response;
  const context = access.context!;

  const startsAt = optionalTime(body.startsAt);
  const dueAt = optionalTime(body.dueAt);
  if (startsAt !== null && !Number.isFinite(startsAt)) return fail("The assignment start time is invalid.");
  if (dueAt !== null && !Number.isFinite(dueAt)) return fail("The assignment due time is invalid.");
  if (startsAt !== null && dueAt !== null && dueAt <= startsAt) return fail("The due time must be after the start time.");

  const db = getDb();
  const [existing] = await db.select().from(labAssignments)
    .where(and(eq(labAssignments.cohortId, cohortId), eq(labAssignments.cartridgeId, cartridgeId)))
    .limit(1);
  const now = Date.now();
  const status = body.action === "close" ? "closed" : effectiveStatus(startsAt, dueAt, now);
  const assignmentId = existing?.id ?? crypto.randomUUID();

  if (existing) {
    await db.update(labAssignments).set({ status, startsAt, dueAt, updatedAt: now }).where(eq(labAssignments.id, existing.id));
  } else {
    await db.insert(labAssignments).values({
      id: assignmentId,
      cohortId,
      cartridgeId,
      status,
      assignedAt: now,
      startsAt,
      dueAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organisationId: context.organisationId,
    actorType: context.controlPlane ? "control_plane" : "institutional_user",
    actorRef: context.email,
    action: body.action === "close" ? "lab_assignment.close" : "lab_assignment.upsert",
    entityType: "lab_assignment",
    entityId: assignmentId,
    metadata: JSON.stringify({ cohortId, cartridgeId, startsAt, dueAt, status }),
    createdAt: now,
  });

  return Response.json({ assignment: { id: assignmentId, cohortId, cartridgeId, title: labById(cartridgeId)?.title, status, startsAt, dueAt } }, { status: existing ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
