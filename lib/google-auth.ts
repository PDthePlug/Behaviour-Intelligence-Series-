const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

type GoogleTokenHeader = {
  alg?: string;
  kid?: string;
};

export type GoogleIdentityClaims = {
  iss: string;
  aud: string | string[];
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  nonce?: string;
  iat: number;
  exp: number;
};

export type GoogleJwkSet = {
  keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>;
};

let cachedKeys: { value: GoogleJwkSet; expiresAt: number } | null = null;

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseSegment<T>(segment: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(segment))) as T;
  } catch {
    throw new Error("Google returned an unreadable identity credential.");
  }
}

function maxAge(response: Response) {
  const match = response.headers.get("cache-control")?.match(/max-age=(\d+)/i);
  return Math.max(60, Math.min(Number(match?.[1]) || 3600, 86_400));
}

export async function fetchGoogleJwks(): Promise<GoogleJwkSet> {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.value;
  const response = await fetch(GOOGLE_JWKS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Google identity verification is temporarily unavailable.");
  const value = await response.json() as GoogleJwkSet;
  if (!Array.isArray(value.keys) || value.keys.length === 0) throw new Error("Google identity keys are unavailable.");
  cachedKeys = { value, expiresAt: Date.now() + maxAge(response) * 1000 };
  return value;
}

export async function verifyGoogleIdToken(
  credential: string,
  options: { clientId: string; nonce: string; jwks?: GoogleJwkSet; now?: number },
): Promise<GoogleIdentityClaims> {
  if (!credential || credential.length > 12_000) throw new Error("The Google identity credential is invalid.");
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("The Google identity credential is malformed.");

  const header = parseSegment<GoogleTokenHeader>(parts[0]);
  const claims = parseSegment<GoogleIdentityClaims>(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("The Google identity signature is not supported.");

  const jwks = options.jwks ?? await fetchGoogleJwks();
  const signingKey = jwks.keys.find((key) => key.kid === header.kid && (!key.alg || key.alg === "RS256"));
  if (!signingKey) throw new Error("The Google identity signing key was not found.");
  const key = await crypto.subtle.importKey(
    "jwk",
    signingKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    fromBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!verified) throw new Error("Google could not verify this sign-in.");

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!GOOGLE_ISSUERS.has(claims.iss)) throw new Error("The Google identity issuer is invalid.");
  if (!audiences.includes(options.clientId)) throw new Error("This Google sign-in belongs to another application.");
  if (!Number.isFinite(claims.exp) || claims.exp <= now - 30) throw new Error("The Google sign-in has expired. Please try again.");
  if (!Number.isFinite(claims.iat) || claims.iat > now + 60) throw new Error("The Google sign-in time is invalid.");
  if (!claims.sub || claims.sub.length > 255) throw new Error("Google did not return a stable account identifier.");
  if (!claims.email_verified || !/^\S+@\S+\.\S+$/.test(claims.email ?? "")) throw new Error("Google did not return a verified email address.");
  if (!claims.nonce || claims.nonce !== options.nonce) throw new Error("The Google sign-in session could not be verified. Please try again.");
  return claims;
}
