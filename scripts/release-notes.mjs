#!/usr/bin/env node
// Release notes for a tag: the CHANGELOG section of that version plus the download
// and privacy notes. Run after build-single.mjs — the asset size is read from dist/.
//
// Usage: node scripts/release-notes.mjs v0.1.1 > dist/notes.md

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (!tag) {
  console.error("error: pass the tag, e.g. v0.1.1");
  process.exit(1);
}
const version = tag.replace(/^v/, "");

const changelog = fs.readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
const start = changelog.indexOf(`## [${version}]`);
if (start < 0) {
  console.error(`error: no "## [${version}]" section in CHANGELOG.md`);
  process.exit(1);
}
const next = changelog.indexOf("\n## [", start + 1);
const section = changelog
  .slice(changelog.indexOf("\n", start) + 1, next < 0 ? undefined : next)
  .replace(/\n\[[^\]]+\]: \S+/g, "") // link definitions at the end of the file
  .trim();

const asset = `claude-code-chat-viewer-${tag}.html`;
const assetPath = path.join(repoRoot, "dist", asset);
const sizeKb = fs.existsSync(assetPath) ? Math.round(fs.statSync(assetPath).size / 1024) : null;

const repo = "https://github.com/hitmman55/claude-code-chat-viewer";
console.log(`${section}

## 📥 Download

Grab **\`${asset}\`** from the assets below${sizeKb ? ` (${sizeKb} KB, [marked](https://github.com/markedjs/marked) v12 inlined)` : ""}. One file: double-click to open in any modern browser. No install, no server, no CDN — works offline.

## Privacy

The viewer makes no automatic network requests; your transcripts stay on your machine. Markdown images in transcripts are shown as inert text (never fetched); images stored inside a transcript (base64) are drawn from the file itself. Links open only on click, with \`rel="noopener noreferrer nofollow"\`. Before sharing a transcript, see [what's personal in it](${repo}#whats-personal-in-a-transcript).

## Where to find your transcripts

\`\`\`
~/.claude/projects/<project-slug>/<session-uuid>.jsonl
\`\`\`

where \`<project-slug>\` is your working directory with every character other than a letter or digit replaced by \`-\`.

[README](${repo}#claude-code-chat-viewer) · [Changelog](${repo}/blob/main/CHANGELOG.md) · Live demo with a "Try with example" button: <https://hitmman55.github.io/claude-code-chat-viewer/>`);
