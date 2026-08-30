import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, institutionalSessions, organisationUserInvites, organisationUsers, organisations } from "@/db/schema";
import { clearInstitutionalSessionCookie, institutionalSessionCookie, institutionalSessionToken, resolveInstitutionalContext } from "@/lib/institutional-access";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/opaque-token";
import { createPasscodeSalt, hashPasscode, hashesMatch } from "@/lib/passcode";

type AuthPayload = {
  action?: "login" | "accept" | "logout";
  organisationSlug?: string;
  email?: string;
  passcode?: string;
  inviteToken?: string;
  firstName?: string;
  surname?: string;
};

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function publicContext(context: NonNullable<Awaited<ReturnType<typeof resolveInstitutionalContext>>>) {
  return {
    organisation: { id: context.organisationId, name: context.organisationName },
    user: {
      id: context.userId,
      email: context.email,
      firstName: context.firstName,
      surname: context.surname,
      role: context.role,
      controlPlane: context.controlPlane,
    },
  };
}

async function createSession(organisationUserId: string) {
  const token = createOpaqueToken();
  const tokenHash = await hashOpaqueToken(token);
  const now = Date.now();
  const db = getDb();
  await db.insert(institutionalSessions).values({
    id: crypto.randomUUID(),
    organisationUserId,
    tokenHash,
    expiresAt: now + SESSION_TTL_MS,
    lastSeenAt: now,
    revokedAt: null,
    createdAt: now,
  });
  return token;
}

export async function GET(request: Request) {
  const context = await resolveInstitutionalContext(request);
  return Response.json({ authenticated: Boolean(context), ...(context ? publicContext(context) : {}) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: AuthPayload;
  try {
    body = await request.json() as AuthPayload;
  } catch {
    return fail("The institutional authentication request is incomplete.");
  }

  const action = body.action ?? "login";
  const db = getDb();
  const now = Date.now();

  if (action === "logout") {
    const token = institutionalSessionToken(request);
    if (token) {
      const tokenHash = await hashOpaqueToken(token);
      await db.update(institutionalSessions).set({ revokedAt: now }).where(eq(institutionalSessions.tokenHash, tokenHash));
    }
    return Response.json({ authenticated: false }, { headers: { "Cache-Control": "no-store", "Set-Cookie": clearInstitutionalSessionCookie() } });
  }

  if (action === "accept") {
    const inviteToken = body.inviteToken?.trim() ?? "";
    const passcode = body.passcode ?? "";
    const firstName = body.firstName?.trim().slice(0, 60) ?? "";
    const surname = body.surname?.trim().slice(0, 60) ?? "";
    if (!inviteToken) return fail("Open a valid institutional invitation.");
    if (firstName.length < 2 || surname.length < 2) return fail("Enter your first name and surname.");
    if (passcode.length < 8 || passcode.length > 64) return fail("Choose an institutional passcode between 8 and 64 characters.");

    const tokenHash = await hashOpaqueToken(inviteToken);
    const [invite] = await db.select().from(organisationUserInvites)
      .where(and(eq(organisationUserInvites.tokenHash, tokenHash), isNull(organisationUserInvites.acceptedAt), gt(organisationUserInvites.expiresAt, now)))
      .limit(1);
    if (!invite) return fail("This invitation is invalid or has expired.", 410);

    const [user] = await db.select().from(organisationUsers)
      .where(and(eq(organisationUsers.organisationId, invite.organisationId), eq(organisationUsers.email, invite.email)))
      .limit(1);
    if (!user) return fail("The invited institutional account no longer exists.", 404);
    if (user.status !== "invited") return fail("This invitation is no longer valid for the current account state.", 409);

    const salt = createPasscodeSalt();
    const passcodeHash = await hashPasscode(passcode, salt);
    await db.batch([
      db.update(organisationUsers).set({
        firstName,
        surname,
        role: invite.role,
        status: "active",
        passcodeHash,
        passcodeSalt: salt,
        lastLoginAt: now,
        updatedAt: now,
      }).where(eq(organisationUsers.id, user.id)),
      db.update(organisationUserInvites).set({ acceptedAt: now }).where(eq(organisationUserInvites.id, invite.id)),
      db.insert(auditEvents).values({
        id: crypto.randomUUID(),
        organisationId: invite.organisationId,
        actorType: "institutional_user",
        actorRef: invite.email,
        action: "institutional.invite.accept",
        entityType: "organisation_user",
        entityId: user.id,
        metadata: JSON.stringify({ role: invite.role }),
        createdAt: now,
      }),
    ]);

    const token = await createSession(user.id);
    const [organisation] = await db.select({ id: organisations.id, name: organisations.name }).from(organisations).where(eq(organisations.id, invite.organisationId)).limit(1);
    return Response.json({
      authenticated: true,
      organisation: organisation ?? { id: invite.organisationId, name: "Institution" },
      user: { id: user.id, email: invite.email, firstName, surname, role: invite.role, controlPlane: false },
    }, { status: 201, headers: { "Cache-Control": "no-store", "Set-Cookie": institutionalSessionCookie(token) } });
  }

  const organisationSlug = body.organisationSlug?.trim().toLowerCase().slice(0, 80) ?? "";
  const email = body.email?.trim().toLowerCase().slice(0, 180) ?? "";
  const passcode = body.passcode ?? "";
  if (!organisationSlug || !/^\S+@\S+\.\S+$/.test(email) || passcode.length < 8) return fail("Enter your organisation code, email and institutional passcode.");

  const [row] = await db.select({
    userId: organisationUsers.id,
    organisationId: organisations.id,
    organisationName: organisations.name,
    email: organisationUsers.email,
    firstName: organisationUsers.firstName,
    surname: organisationUsers.surname,
    role: organisationUsers.role,
    status: organisationUsers.status,
    organisationStatus: organisations.status,
    passcodeHash: organisationUsers.passcodeHash,
    passcodeSalt: organisationUsers.passcodeSalt,
  }).from(organisationUsers)
    .innerJoin(organisations, eq(organisations.id, organisationUsers.organisationId))
    .where(and(eq(organisations.slug, organisationSlug), eq(organisationUsers.email, email)))
    .limit(1);

  if (!row || row.status !== "active" || row.organisationStatus !== "active" || !row.passcodeHash || !row.passcodeSalt) return fail("That institutional account is not active.", 401);
  const candidate = await hashPasscode(passcode, row.passcodeSalt);
  if (!hashesMatch(candidate, row.passcodeHash)) return fail("That institutional passcode does not match.", 401);

  await db.update(organisationUsers).set({ lastLoginAt: now, updatedAt: now }).where(eq(organisationUsers.id, row.userId));
  const token = await createSession(row.userId);
  return Response.json({
    authenticated: true,
    organisation: { id: row.organisationId, name: row.organisationName },
    user: { id: row.userId, email: row.email, firstName: row.firstName, surname: row.surname, role: row.role, controlPlane: false },
  }, { headers: { "Cache-Control": "no-store", "Set-Cookie": institutionalSessionCookie(token) } });
}
