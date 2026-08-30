import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { learnerProfiles } from "@/db/schema";
import { createPasscodeSalt, hashPasscode, hashesMatch } from "@/lib/passcode";
import { publicLearnerProfile } from "@/lib/learner-profile";
import { sessionFromRequest } from "@/lib/session";

type ProfilePayload = {
  action?: "register" | "login" | "update";
  firstName?: string;
  surname?: string;
  email?: string;
  passcode?: string;
  country?: string;
  selectedPattern?: string;
  profileStyle?: string;
};

const allowedPatterns = new Set([
  "Phone & Screen Habits",
  "Procrastination",
  "Focus & Distraction",
  "Spending Habits",
  "Sleep Patterns",
  "Something Else",
]);
const allowedProfileStyles = new Set(["quiet", "curious", "focused"]);

function failure(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function getProfile(request: Request) {
  const sessionId = sessionFromRequest(request);
  if (!sessionId) return Response.json({ profile: null }, { headers: { "Cache-Control": "no-store" } });
  const db = getDb();
  const [profile] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.sessionId, sessionId)).limit(1);
  return Response.json({ profile: profile ? publicLearnerProfile(profile) : null }, { headers: { "Cache-Control": "no-store" } });
}

async function postProfile(request: Request) {
  const sessionId = sessionFromRequest(request);
  if (!sessionId) return failure("Your private session has not started. Refresh and try again.", 401);

  let body: ProfilePayload;
  try {
    body = (await request.json()) as ProfilePayload;
  } catch {
    return failure("The profile request was incomplete. Refresh and try again.");
  }
  const action = body.action ?? "register";
  const db = getDb();

  if (action === "login") {
    const email = body.email?.trim().toLowerCase() ?? "";
    const passcode = body.passcode ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email) || passcode.length < 4) return failure("Enter your email and passcode.");
    const [profile] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.email, email)).limit(1);
    if (!profile) return failure("We could not find that learner profile.", 404);
    const candidate = await hashPasscode(passcode, profile.passcodeSalt);
    if (!hashesMatch(candidate, profile.passcodeHash)) return failure("That passcode does not match this profile.", 401);
    await db.update(learnerProfiles).set({ sessionId, updatedAt: Date.now() }).where(eq(learnerProfiles.id, profile.id));
    return Response.json({ profile: publicLearnerProfile({ ...profile, sessionId }) }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "update") {
    const [existing] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.sessionId, sessionId)).limit(1);
    if (!existing) return failure("Open your learner profile first.", 404);
    const firstName = body.firstName?.trim().slice(0, 60) || existing.firstName;
    const surname = body.surname?.trim().slice(0, 60) || existing.surname;
    const country = body.country?.trim().slice(0, 80) || existing.country;
    const requestedPattern = body.selectedPattern?.trim().slice(0, 80);
    const requestedStyle = body.profileStyle?.trim().slice(0, 24);
    const selectedPattern = requestedPattern && allowedPatterns.has(requestedPattern) ? requestedPattern : existing.selectedPattern;
    const profileStyle = requestedStyle && allowedProfileStyles.has(requestedStyle) ? requestedStyle : existing.profileStyle;

    if (firstName.length < 2 || surname.length < 2) return failure("Enter your first name and surname.");
    if (country.length < 2) return failure("Enter your country.");

    const updatedAt = Date.now();
    const updatedProfile = { ...existing, firstName, surname, country, selectedPattern, profileStyle, updatedAt };
    await db
      .update(learnerProfiles)
      .set({ firstName, surname, country, selectedPattern, profileStyle, updatedAt })
      .where(eq(learnerProfiles.id, existing.id));
    return Response.json(
      { profile: publicLearnerProfile(updatedProfile) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const firstName = body.firstName?.trim().slice(0, 60) ?? "";
  const surname = body.surname?.trim().slice(0, 60) ?? "";
  const email = body.email?.trim().toLowerCase().slice(0, 180) ?? "";
  const passcode = body.passcode ?? "";
  if (firstName.length < 2 || surname.length < 2) return failure("Enter your first name and surname.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return failure("Enter a valid email address.");
  if (passcode.length < 4 || passcode.length > 32) return failure("Choose a passcode between 4 and 32 characters.");

  const [existingEmail] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.email, email)).limit(1);
  if (existingEmail) return failure("A profile already uses this email. Choose ‘I’ve been here before’ to sign in.", 409);

  const salt = createPasscodeSalt();
  const now = Date.now();
  const profile = {
    id: crypto.randomUUID(),
    sessionId,
    firstName,
    surname,
    email,
    passcodeHash: await hashPasscode(passcode, salt),
    passcodeSalt: salt,
    authProvider: "passcode",
    googleSubject: null,
    avatarUrl: null,
    country: body.country?.trim().slice(0, 80) || "South Africa",
    selectedPattern: body.selectedPattern?.trim().slice(0, 80) || "Focus & Distraction",
    profileStyle: body.profileStyle?.trim().slice(0, 24) || "quiet",
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(learnerProfiles).values(profile);
  return Response.json({ profile: publicLearnerProfile(profile) }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    return await getProfile(request);
  } catch (error) {
    console.error("BIS profile lookup failed", error);
    return failure("Your learner profile is temporarily unavailable. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  try {
    return await postProfile(request);
  } catch (error) {
    console.error("BIS profile authentication failed", error);
    return failure("Your learner profile could not be opened. Please try again.", 500);
  }
}
