// The version shown in the header must be the latest released one in CHANGELOG.md;
// scripts/build-single.mjs refuses a release tag that differs from it.
// Run: node --test test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");

test("VERSION in index.html is the latest released version in CHANGELOG.md", () => {
  const version = html.match(/const VERSION = "([^"]+)";/)?.[1];
  assert.ok(version, "const VERSION not found in index.html");
  const released = changelog.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1];
  assert.equal(version, released);
});

test("the header has a place for the version", () => {
  assert.match(html, /id="version"/);
});
