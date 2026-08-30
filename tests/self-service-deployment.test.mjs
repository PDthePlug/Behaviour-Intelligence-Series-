import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("institutional staff authentication uses hashed opaque sessions and one-time invitations", () => {
  const auth = source("app/api/institutional/auth/route.ts");
  const tokens = source("lib/opaque-token.ts");
  const access = source("lib/institutional-access.ts");
  assert.match(auth, /hashOpaqueToken\(inviteToken\)/);
  assert.match(auth, /passcode\.length < 8/);
  assert.match(auth, /institutionalSessionCookie\(token\)/);
  assert.match(auth, /acceptedAt: now/);
  assert.match(auth, /user\.status !== "invited"/);
  assert.match(tokens, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(access, /bis_institutional_session/);
  assert.doesNotMatch(auth, /tokenHash:\s*token\b/);
});

test("role capability and cohort tenancy checks are centralized", () => {
  const access = source("lib/institutional-access.ts");
  assert.match(access, /owner: new Set/);
  assert.match(access, /admin: new Set/);
  assert.match(access, /facilitator: new Set/);
  assert.match(access, /viewer: new Set/);
  assert.match(access, /cohort\.organisationId !== context\.organisationId/);
  assert.match(access, /facilitatorCohorts\.organisationUserId/);
  assert.match(access, /You are not assigned to this cohort/);
});

test("staff invitations carry role and facilitator cohort scope without storing raw invite tokens", () => {
  const users = source("app/api/institutional/users/route.ts");
  assert.match(users, /createOpaqueToken/);
  assert.match(users, /hashOpaqueToken\(token\)/);
  assert.match(users, /facilitatorCohorts/);
  assert.match(users, /Only an organisation owner can invite another owner/);
  assert.match(users, /organisationUserInvites\.acceptedAt/);
  assert.match(users, /isNull\(organisationUserInvites\.acceptedAt\)/);
  assert.match(users, /acceptPath/);
  assert.doesNotMatch(users, /tokenHash,\s*token,/);
});

test("learner invitation claims require learner identity and capture learner participation consent", () => {
  const links = source("app/api/institutional/enrolment-links/route.ts");
  const enrolment = source("app/api/enrolment/route.ts");
  const join = source("components/bis/JoinExperience.tsx");
  assert.match(links, /hashOpaqueToken\(token\)/);
  assert.match(links, /requireLearnerConsent/);
  assert.match(enrolment, /sessionFromRequest/);
  assert.match(enrolment, /consentType: "learner_participation"/);
  assert.match(enrolment, /private reflection words are not shared/i);
  assert.match(enrolment, /alreadyMember: true/);
  assert.match(join, /My private reflection words remain private/);
});

test("break-glass enrolment cannot activate institutional evidence without learner consent", () => {
  const legacyEnrol = source("app/api/institutional/enrol/route.ts");
  const lab = source("app/api/lab/route.ts");
  assert.match(legacyEnrol, /status: "pending_consent"/);
  assert.match(legacyEnrol, /pendingConsent: true/);
  assert.match(legacyEnrol, /evidenceEligible: false/);
  assert.match(legacyEnrol, /learner must claim an authorised enrolment link/i);
  assert.match(lab, /eq\(cohortMembers\.status, "active"\)/);
});

test("Lab scheduling is represented in assignment administration and enforced when learner evidence is linked", () => {
  const assignments = source("app/api/institutional/assignments/route.ts");
  const lab = source("app/api/lab/route.ts");
  assert.match(assignments, /effectiveStatus/);
  assert.match(assignments, /startsAt/);
  assert.match(assignments, /dueAt/);
  assert.match(lab, /match\.startsAt && match\.startsAt > now/);
  assert.match(lab, /match\.dueAt && match\.dueAt < now/);
  assert.match(lab, /match\.status !== "active" && match\.status !== "scheduled"/);
});

test("institutional workspace exposes role-aware operations without the break-glass key", () => {
  const consoleSource = source("components/bis/InstitutionalConsole.tsx");
  assert.match(consoleSource, /Institutional sign in/);
  assert.match(consoleSource, /Create learner link/);
  assert.match(consoleSource, /Invite staff/);
  assert.match(consoleSource, /Assign \/ schedule Lab/);
  assert.match(consoleSource, /Record anchored observation/);
  assert.doesNotMatch(consoleSource, /x-bis-admin-key/);
});
