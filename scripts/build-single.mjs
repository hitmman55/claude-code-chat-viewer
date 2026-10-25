#!/usr/bin/env node
// Build a standalone single-file HTML by inlining lib/marked.min.js into index.html.
// Output: dist/claude-code-chat-viewer-<version>.html
//
// Usage: node scripts/build-single.mjs [version]
//   version — e.g. "v0.1.0" (defaults to $GITHUB_REF_NAME or "dev")

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2] || process.env.GITHUB_REF_NAME || "dev";
const outDir = path.join(repoRoot, "dist");

fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");
const marked = fs.readFileSync(path.join(repoRoot, "lib/marked.min.js"), "utf8");

// A release tag must name the version the page shows (const VERSION in index.html).
const shown = html.match(/const VERSION = "([^"]+)";/)?.[1];
if (/^v\d/.test(version) && version !== `v${shown}`) {
  console.error(`error: tag ${version} but index.html shows v${shown} — update VERSION and CHANGELOG.md`);
  process.exit(1);
}

const scriptTag = '<script src="lib/marked.min.js"></script>';
if (!html.includes(scriptTag)) {
  console.error(`error: could not find ${scriptTag} in index.html`);
  process.exit(1);
}

const banner = `    <!-- claude-code-chat-viewer ${version} — https://github.com/hitmman55/claude-code-chat-viewer -->`;

const bundled = html
  .replace(scriptTag, `<script>${marked}</script>`)
  .replace("<head>", `<head>\n${banner}`);

const outFile = path.join(outDir, `claude-code-chat-viewer-${version}.html`);
fs.writeFileSync(outFile, bundled);

const sizeKb = Math.round(Buffer.byteLength(bundled) / 1024);
console.log(`Built ${path.relative(repoRoot, outFile)} — ${sizeKb} KB`);
