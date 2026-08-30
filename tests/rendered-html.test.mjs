import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const dist = (relativePath) => fileURLToPath(new URL(`../dist/${relativePath}`, import.meta.url));

test("packages a deployable Cloudflare Sites build", () => {
  assert.ok(existsSync(dist("server/index.js")), "vinext must emit the Cloudflare worker bundle");
  assert.ok(existsSync(dist(".openai/hosting.json")), "the Sites build must package hosting metadata");
  assert.ok(existsSync(dist(".openai/drizzle")), "the Sites build must package D1 migrations");

  const hosting = JSON.parse(readFileSync(dist(".openai/hosting.json"), "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.ok(typeof hosting.project_id === "string" && hosting.project_id.length > 0);
});
