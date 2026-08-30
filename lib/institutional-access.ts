import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { cohorts, facilitatorCohorts, institutionalSessions, organisationUsers, organisations } from "@/db/schema";
import { controlPlaneAuthorized } from "@/lib/institutional-auth";
import { hashOpaqueToken } from "@/lib/opaque-token";

export type InstitutionalRole = "owner" | "admin" | "facilitator" | "viewer";
export type InstitutionalCapability =
  | "cohorts:read"
  | "cohorts:write"
  | "users:read"
  | "users:write"
  | "assignments:read"
  | "assignments:write"
  | "enrolment:read"
  | "enrolment:write"
  | "observations:write"
  | "outcomes:read"
  | "reports:write";

export type InstitutionalContext = {
  controlPlane: boolean;
  organisationId: string | null;
  organisationName: string;
  userId: string | null;
  email: string;
  firstName: string | null;
  surname: string | null;
  role: InstitutionalRole;
};

const COOKIE_NAME = "bis_institutional_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const capabilities: Record<InstitutionalRole, Set<InstitutionalCapability>> = {
  owner: new Set(["cohorts:read", "cohorts:write", "users:read", "users:write", "assignments:read", "assignments:write", "enrolment:read", "enrolment:write", "observations:write", "outcomes:read", "reports:write"]),
  admin: new Set(["cohorts:read", "cohorts:write", "users:read", "users:write", "assignments:read", "assignments:write", "enrolment:read", "enrolment:write", "observations:write", "outcomes:read", "reports:write"]),
  facilitator: new Set(["cohorts:read", "assignments:read", "enrolment:read", "enrolment:write", "observations:write", "outcomes:read"]),
  viewer: new Set(["cohorts:read", "assignments:read", "enrolment:read", "outcomes:read"]),
};

function parseCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function isRole(value: string): value is InstitutionalRole {
  return value === "owner" || value === "admin" || value === "facilitator" || value === "viewer";
}

function denial(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function institutionalSessionCookie(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearInstitutionalSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function institutionalSessionToken(request: Request) {
  return parseCookie(request, COOKIE_NAME);
}

export async function resolveInstitutionalContext(request: Request): Promise<InstitutionalContext | null> {
  if (await controlPlaneAuthorized(request)) {
    return {
      controlPlane: true,
      organisationId: null,
      organisationName: "BIS Control Plane",
      userId: null,
      email: "control-plane",
      firstName: "BIS",
      surname: "Control Plane",
      role: "owner",
    };
  }

  const token = institutionalSessionToken(request);
  if (!token) return null;
  const tokenHash = await hashOpaqueToken(token);
  const db = getDb();
  const now = Date.now();
  const [row] = await db
    .select({
      sessionId: institutionalSessions.id,
      organisationId: organisationUsers.organisationId,
      organisationName: organisations.name,
      organisationStatus: organisations.status,
      userId: organisationUsers.id,
      email: organisationUsers.email,
      firstName: organisationUsers.firstName,
      surname: organisationUsers.surname,
      role: organisationUsers.role,
      userStatus: organisationUsers.status,
    })
    .from(institutionalSessions)
    .innerJoin(organisationUsers, eq(organisationUsers.id, institutionalSessions.organisationUserId))
    .innerJoin(organisations, eq(organisations.id, organisationUsers.organisationId))
    .where(and(
      eq(institutionalSessions.tokenHash, tokenHash),
      isNull(institutionalSessions.revokedAt),
      gt(institutionalSessions.expiresAt, now),
    ))
    .limit(1);

  if (!row || row.userStatus !== "active" || row.organisationStatus !== "active" || !isRole(row.role)) return null;
  await db.update(institutionalSessions).set({ lastSeenAt: now }).where(eq(institutionalSessions.id, row.sessionId));

  return {
    controlPlane: false,
    organisationId: row.organisationId,
    organisationName: row.organisationName,
    userId: row.userId,
    email: row.email,
    firstName: row.firstName,
    surname: row.surname,
    role: row.role,
  };
}

export async function requireInstitutionalAccess(
  request: Request,
  capability: InstitutionalCapability,
  cohortId?: string,
): Promise<{ context: InstitutionalContext | null; response: Response | null }> {
  const context = await resolveInstitutionalContext(request);
  if (!context) return { context: null, response: denial("Institutional sign-in required.", 401) };
  if (!capabilities[context.role].has(capability)) return { context: null, response: denial("Your institutional role does not permit this action.", 403) };
  if (!cohortId || context.controlPlane) return { context, response: null };

  const db = getDb();
  const [cohort] = await db.select({ organisationId: cohorts.organisationId }).from(cohorts).where(eq(cohorts.id, cohortId)).limit(1);
  if (!cohort) return { context: null, response: denial("That cohort does not exist.", 404) };
  if (cohort.organisationId !== context.organisationId) return { context: null, response: denial("That cohort belongs to another organisation.", 403) };

  if (context.role === "facilitator") {
    const [scope] = await db.select({ id: facilitatorCohorts.id }).from(facilitatorCohorts)
      .where(and(eq(facilitatorCohorts.organisationUserId, context.userId as string), eq(facilitatorCohorts.cohortId, cohortId)))
      .limit(1);
    if (!scope) return { context: null, response: denial("You are not assigned to this cohort.", 403) };
  }

  return { context, response: null };
}
