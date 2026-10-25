// Second small batch (2026-10-26): what is hidden is counted, the CLI's own "typed"
// mark beats text patterns, a run of tool calls folds into one line, search in a session.
// Run: node --test test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const section = (name) => {
  const start = html.indexOf(`// ===== ${name} =====`);
  const end = html.indexOf(`// ===== end ${name} =====`);
  assert.ok(start >= 0 && end > start, `${name} section markers not found in index.html`);
  return html.slice(start, end);
};
const T = new Function(
  section("triage") +
    section("rules") +
    "\nreturn { buildIndex, computeStats, planUserRecord, toolRunLabel, searchTerms, textMatches, rowSearchParts, kindVisible };",
)();

test("records hidden on purpose are counted by kind", () => {
  const rows = [
    { type: "custom-title", customTitle: "A" },
    { type: "custom-title", customTitle: "A" }, // a repeat: hidden
    { type: "custom-title", customTitle: "A" },
    { type: "attachment", uuid: "t", attachment: { type: "task_reminder", itemCount: 0 } },
    { type: "attachment", uuid: "c", attachment: { type: "credential_org" } },
    { type: "user", uuid: "x", message: { content: "hi" } },
  ];
  assert.deepEqual(T.computeStats(rows).hidden, { "attachment:credential_org": 1, "attachment:task_reminder": 1, "custom-title": 2 });
  assert.deepEqual(T.computeStats([{ type: "user", uuid: "x", message: { content: "hi" } }]).hidden, {});
});

test("what the CLI marked as typed is the human's, whatever the text looks like", () => {
  const u = (text, extra = {}) => ({ type: "user", uuid: "u" + text.length, message: { content: [{ type: "text", text }] }, ...extra });
  for (const t of ["[Request interrupted by user]", "<system-reminder>посмотри</system-reminder>", "<task-notification>x"])
    assert.equal(T.computeStats([u(t, { promptSource: "typed" })]).nUser, 1, t);
  assert.equal(T.computeStats([u("[Request interrupted by user]")]).nUser, 0, "without the mark it stays the CLI's marker");
  assert.equal(T.computeStats([u("[Request interrupted by user]", { promptSource: "system" })]).nUser, 0);
});

test("a run of tool calls folds into one line, most used first", () => {
  assert.equal(T.toolRunLabel(["Read", "Bash", "Read", "Grep", "Read", "Bash"]), "6 · Read ×3 · Bash ×2 · Grep");
  assert.equal(T.toolRunLabel(["Edit"]), "1 · Edit");
  assert.equal(T.toolRunLabel(["a", "b", "c", "d", "e", "f"]), "6 · a · b · c · d · +2");
});

test("search terms: words in any order, a quoted phrase as one term, any script", () => {
  assert.deepEqual(T.searchTerms('Ошибка  "base URL" fetch'), ["ошибка", "base url", "fetch"]);
  assert.deepEqual(T.searchTerms('  "" '), []);
  assert.equal(T.textMatches("Fetch the Base URL — ошибка была тут", T.searchTerms('ошибка "base url"')), true);
  assert.equal(T.textMatches("base and url apart", T.searchTerms('"base url"')), false);
  assert.equal(T.textMatches("ЁЖИК", ["ёжик"]), true);
});

test("search parts are the blocks the feed shows, with their kind and its bounds", () => {
  const idx = T.buildIndex([]);
  assert.deepEqual(T.rowSearchParts({ type: "user", message: { content: "Привет мир" } }, idx), [{ kind: "user", text: "Привет мир" }]);
  const a = { type: "assistant", message: { content: [{ type: "text", text: "TERMA" }, { type: "thinking", thinking: "думаю" }, { type: "tool_use", name: "Bash", input: { command: "dir C:\\Users\\bob" } }] } };
  const parts = T.rowSearchParts(a, idx);
  assert.deepEqual(parts.map((p) => p.kind), ["assistant", "thinking", "tool-use"]);
  assert.match(parts[2].text, /dir C:\\Users\\bob/, "the raw value, as the card header shows it");
  // one hit per block: terms spread over two blocks are not one hit
  assert.equal(parts.filter((p) => T.textMatches(p.text, ["terma", "думаю"])).length, 0);
  // bounded like the feed: a result shows its first 5 000 characters
  const res = { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t", content: "x".repeat(6000) + " TAIL" }] } };
  const [r] = T.rowSearchParts(res, idx);
  assert.equal(r.kind, "tool-result");
  assert.ok(!T.textMatches(r.text, ["tail"]));
  assert.deepEqual(T.rowSearchParts({ type: "custom-title", customTitle: "Моё имя" }, idx).map((p) => p.kind), ["ui"]);
});

test("which kinds the filters show — the same table as the CSS", () => {
  const on = { thinking: true, tools: true, results: true, system: false, hooks: false, ui: false, reader: false };
  assert.equal(T.kindVisible("assistant", on), true);
  assert.equal(T.kindVisible("system", on), false);
  assert.equal(T.kindVisible("meta", on), false);
  assert.equal(T.kindVisible("tool-result error", on), true);
  assert.equal(T.kindVisible("thinking", { ...on, thinking: false }), false);
  assert.equal(T.kindVisible("tool-use", { ...on, reader: true }), false);
  assert.equal(T.kindVisible("assistant report", { ...on, reader: true }), true);
  assert.equal(T.kindVisible("system divider", { ...on, reader: true }), true);
  assert.equal(T.kindVisible("hook error", { ...on, hooks: true }), true);
});

test("case folding keeps the length, so a hit maps back to the text", () => {
  assert.equal(T.textMatches("İstanbul", ["istanbul"]), true);
  assert.equal(T.textMatches("ЁЖИК", ["ёжик"]), true);
});

test("the echo of a manual /compact is counted as hidden", () => {
  const rows = [
    { type: "user", uuid: "c", message: { content: "/compact keep it" } },
    { type: "system", subtype: "compact_boundary", uuid: "b", parentUuid: null, compactMetadata: { trigger: "manual" } },
    { type: "user", uuid: "d", message: { content: "<command-name>/compact</command-name><command-args>keep it</command-args>" } },
  ];
  assert.equal(T.computeStats(rows).hidden["/compact echo"], 1);
});
