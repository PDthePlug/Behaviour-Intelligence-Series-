import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const distRoot = fileURLToPath(new URL("../dist", import.meta.url));

function textFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...textFiles(path));
      continue;
    }
    if (/\.(?:html|js|mjs|cjs|json)$/i.test(entry) && stat.size <= 8_000_000) files.push(path);
  }
  return files;
}

test("emits development preview metadata in the production build", () => {
  const emitted = textFiles(distRoot);
  assert.ok(emitted.length > 0, "the vinext build must emit inspectable production artifacts");

  const metadataFile = emitted.find((path) => {
    const content = readFileSync(path, "utf8");
    return content.includes("codex-preview") && content.includes("development");
  });

  assert.ok(
    metadataFile,
    "the production build must contain the codex-preview development metadata without requiring Node to execute the Cloudflare worker bundle",
  );
});
