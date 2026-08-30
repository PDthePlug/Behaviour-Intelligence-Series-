import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, cohorts, deployments, labAssignments, organisationUsers, organisations } from "@/db/schema";
import { institutionalActor, institutionalAdminFailure } from "@/lib/institutional-auth";
import { defaultLab, labById } from "@/lib/lab-catalog";

type BootstrapPayload = {
  organisationName?: string;
  organisationSlug?: string;
  adminEmail?: string;
  deploymentName?: string;
  cohortName?: string;
  cartridgeIds?: string[];
  startsAt?: number;
  endsAt?: number;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = institutionalAdminFailure(request);
  if (denied) return denied;

  let body: BootstrapPayload;
  try {
    body = await request.json() as BootstrapPayload;
  } catch {
    return fail("The institutional setup request is incomplete.");
  }

  const organisationName = cleanText(body.organisationName, 120);
  const organisationSlug = slugify(cleanText(body.organisationSlug, 80) || organisationName);
  const deploymentName = cleanText(body.deploymentName, 120);
  const cohortName = cleanText(body.cohortName, 120);
  const adminEmail = cleanText(body.adminEmail, 180).toLowerCase();
  if (organisationName.length < 2 || organisationSlug.length < 2) return fail("Enter a valid organisation name.");
  if (deploymentName.length < 2) return fail("Enter a deployment name.");
  if (cohortName.length < 2) return fail("Enter a cohort name.");
  if (adminEmail && !/^\S+@\S+\.\S+$/.test(adminEmail)) return fail("Enter a valid institutional admin email.");

  const requestedCartridges = Array.isArray(body.cartridgeIds) && body.cartridgeIds.length
    ? [...new Set(body.cartridgeIds.map((value) => cleanText(value, 100)).filter(Boolean))]
    : [defaultLab.cartridgeId];
  if (requestedCartridges.length > 12) return fail("A pilot deployment can assign at most 12 Labs at once.");
  for (const cartridgeId of requestedCartridges) {
    if (!labById(cartridgeId)) return fail(`The Lab cartridge '${cartridgeId}' is not published.`);
  }

  const db = getDb();
  const [existing] = await db.select({ id: organisations.id }).from(organisations).where(eq(organisations.slug, organisationSlug)).limit(1);
  if (existing) return fail("An organisation already uses that slug.", 409);

  const now = Date.now();
  const organisationId = crypto.randomUUID();
  const deploymentId = crypto.randomUUID();
  const cohortId = crypto.randomUUID();
  const actor = institutionalActor(request);

  await db.batch([
    db.insert(organisations).values({
      id: organisationId,
      name: organisationName,
      slug: organisationSlug,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(deployments).values({
      id: deploymentId,
      organisationId,
      name: deploymentName,
      status: "active",
      startsAt: Number.isFinite(body.startsAt) ? Number(body.startsAt) : null,
      endsAt: Number.isFinite(body.endsAt) ? Number(body.endsAt) : null,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(cohorts).values({
      id: cohortId,
      organisationId,
      deploymentId,
      name: cohortName,
      status: "active",
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organisationId,
      actorType: "institutional_admin",
      actorRef: actor,
      action: "institutional.bootstrap",
      entityType: "cohort",
      entityId: cohortId,
      metadata: JSON.stringify({ deploymentId, cartridgeIds: requestedCartridges }),
      createdAt: now,
    }),
  ]);

  if (adminEmail) {
    await db.insert(organisationUsers).values({
      id: crypto.randomUUID(),
      organisationId,
      email: adminEmail,
      role: "owner",
      status: "invited",
      createdAt: now,
      updatedAt: now,
    });
  }

  const assignments = [];
  for (const cartridgeId of requestedCartridges) {
    const assignment = { id: crypto.randomUUID(), cartridgeId };
    await db.insert(labAssignments).values({
      id: assignment.id,
      cohortId,
      cartridgeId,
      status: "active",
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    assignments.push(assignment);
  }

  return Response.json({
    organisation: { id: organisationId, name: organisationName, slug: organisationSlug },
    deployment: { id: deploymentId, name: deploymentName },
    cohort: { id: cohortId, name: cohortName },
    assignments,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
