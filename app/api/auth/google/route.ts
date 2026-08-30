import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { learnerProfiles } from "@/db/schema";
import { publicLearnerProfile } from "@/lib/learner-profile";
import { fetchGoogleJwks, verifyGoogleIdToken } from "@/lib/google-auth";
import { requestCookie, sessionFromRequest } from "@/lib/session";

const GOOGLE_NONCE_COOKIE = "bis_google_nonce";

type GoogleAuthPayload = {
  credential?: string;
  selectedPattern?: string;
  profileStyle?: string;
  country?: string;
};

function googleClientId() {
  return (env as unknown as { GOOGLE_CLIENT_ID?: string }).GOOGLE_CLIENT_ID?.trim() ?? "";
}

function response(body: unknown, status = 200, cookie?: string) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
}

function nonceCookie(nonce: string) {
  return `${GOOGLE_NONCE_COOKIE}=${encodeURIComponent(nonce)}; Path=/api/auth/google; Max-Age=600; HttpOnly; SameSite=Lax; Secure`;
}

function clearNonceCookie() {
  return `${GOOGLE_NONCE_COOKIE}=; Path=/api/auth/google; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;
}

function learnerNames(claims: { name?: string; given_name?: string; family_name?: string }) {
  const fullName = claims.name?.trim().split(/\s+/).filter(Boolean) ?? [];
  return {
    firstName: (claims.given_name?.trim() || fullName[0] || "BIS").slice(0, 60),
    surname: (claims.family_name?.trim() || fullName.slice(1).join(" ") || "Learner").slice(0, 60),
  };
}

export async function GET() {
  const clientId = googleClientId();
  if (!clientId) return response({ enabled: false });
  const nonce = crypto.randomUUID();
  return response({ enabled: true, clientId, nonce }, 200, nonceCookie(nonce));
}

export async function POST(request: Request) {
  try {
    const clientId = googleClientId();
    if (!clientId) return response({ error: "Google sign-in has not been configured yet." }, 503);
    const sessionId = sessionFromRequest(request);
    if (!sessionId) return response({ error: "Your private session has not started. Refresh and try again." }, 401);
    const nonce = requestCookie(request, GOOGLE_NONCE_COOKIE);
    if (!nonce) return response({ error: "The Google sign-in session expired. Please try again." }, 401, clearNonceCookie());

    let body: GoogleAuthPayload;
    try {
      body = await request.json() as GoogleAuthPayload;
    } catch {
      return response({ error: "Google returned an incomplete sign-in request." }, 400, clearNonceCookie());
    }

    let claims;
    try {
      claims = await verifyGoogleIdToken(body.credential ?? "", {
        clientId,
        nonce,
        jwks: await fetchGoogleJwks(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google could not verify this sign-in.";
      return response({ error: message }, 401, clearNonceCookie());
    }
    const email = claims.email.trim().toLowerCase().slice(0, 180);
    const db = getDb();
    const [subjectProfile] = await db.select().from(learnerProfiles).where(eq(learnerProfiles.googleSubject, claims.sub)).limit(1);
    const [emailProfile] = subjectProfile ? [] : await db.select().from(learnerProfiles).where(eq(learnerProfiles.email, email)).limit(1);
    const existing = subjectProfile ?? emailProfile;
    const now = Date.now();
    const names = learnerNames(claims);
    const avatarUrl = claims.picture?.startsWith("https://") ? claims.picture.slice(0, 500) : null;

    if (existing) {
      if (existing.googleSubject && existing.googleSubject !== claims.sub) {
        return response({ error: "This email is already linked to another Google identity." }, 409, clearNonceCookie());
      }
      const authProvider = existing.authProvider.includes("passcode") ? "passcode+google" : "google";
      const updated = {
        ...existing,
        sessionId,
        googleSubject: claims.sub,
        authProvider,
        avatarUrl: avatarUrl ?? existing.avatarUrl,
        updatedAt: now,
      };
      await db.update(learnerProfiles).set({
        sessionId: updated.sessionId,
        googleSubject: updated.googleSubject,
        authProvider: updated.authProvider,
        avatarUrl: updated.avatarUrl,
        updatedAt: now,
      }).where(eq(learnerProfiles.id, existing.id));
      return response({ profile: publicLearnerProfile(updated), created: false }, 200, clearNonceCookie());
    }

    const profile = {
      id: crypto.randomUUID(),
      sessionId,
      firstName: names.firstName,
      surname: names.surname,
      email,
      passcodeHash: `GOOGLE_ONLY:${crypto.randomUUID()}`,
      passcodeSalt: crypto.randomUUID().replaceAll("-", ""),
      authProvider: "google",
      googleSubject: claims.sub,
      avatarUrl,
      country: body.country?.trim().slice(0, 80) || "South Africa",
      selectedPattern: body.selectedPattern?.trim().slice(0, 80) || "Focus & Distraction",
      profileStyle: body.profileStyle?.trim().slice(0, 24) || "quiet",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(learnerProfiles).values(profile);
    return response({ profile: publicLearnerProfile(profile), created: true }, 201, clearNonceCookie());
  } catch (error) {
    console.error("BIS Google authentication failed", error);
    return response({ error: "Google sign-in is temporarily unavailable. Please try again." }, 500, clearNonceCookie());
  }
}
