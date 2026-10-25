#!/usr/bin/env node
// Syntax check of the inline scripts in index.html — `node --check` for code that
// lives inside HTML. Compiles each <script> without a src, never runs it.
//
// Usage: node scripts/check-syntax.mjs

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");

const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!scripts.length) {
  console.error("error: no inline <script> found in index.html");
  process.exit(1);
}

let failed = false;
scripts.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `index.html <script #${i + 1}>` });
  } catch (err) {
    failed = true;
    console.error(err.stack ?? String(err));
  }
});
if (failed) process.exit(1);
console.log(`index.html: ${scripts.length} inline script(s) compile`);
