import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

function base64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

test("uses the Cloudflare-supported PBKDF2 limit and verifies matching passcodes", async () => {
  const { PASSCODE_PBKDF2_ITERATIONS, createPasscodeSalt, hashPasscode, hashesMatch } = await vite.ssrLoadModule("/lib/passcode.ts");
  assert.equal(PASSCODE_PBKDF2_ITERATIONS, 100_000);
  const salt = createPasscodeSalt();
  const first = await hashPasscode("quiet-evidence", salt);
  const second = await hashPasscode("quiet-evidence", salt);
  assert.equal(first.length, 64);
  assert.equal(hashesMatch(first, second), true);
  assert.equal(hashesMatch(first, await hashPasscode("different", salt)), false);
});

test("accepts a correctly signed Google identity token and rejects a replayed nonce", async () => {
  const { verifyGoogleIdToken } = await vite.ssrLoadModule("/lib/google-auth.ts");
  const keys = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const now = Math.floor(Date.now() / 1000);
  const clientId = "bis-google-client.apps.googleusercontent.com";
  const nonce = "bis-nonce";
  const header = base64Url(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "google-subject-123",
    email: "learner@example.com",
    email_verified: true,
    nonce,
    iat: now,
    exp: now + 600,
  }));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  const credential = `${header}.${payload}.${base64Url(signature)}`;
  const jwks = { keys: [{ ...publicKey, kid: "test-key", alg: "RS256", use: "sig" }] };

  const claims = await verifyGoogleIdToken(credential, { clientId, nonce, jwks, now });
  assert.equal(claims.email, "learner@example.com");
  await assert.rejects(
    verifyGoogleIdToken(credential, { clientId, nonce: "replayed-nonce", jwks, now }),
    /session could not be verified/i,
  );
});
