// Findings of the "competitors' mistakes" audit (2026-10-26): a value that String()
// can't convert kills the file, unknown content blocks vanish without a trace, a tool
// reference is dumped as JSON, cutting text splits an emoji in half.
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
    "\nreturn { buildIndex, computeStats, describeRecord, describeTool, planUserRecord, planAssistantRecord, blockText, clip, safeSlice };",
)();

const evil = { toString: 1 }; // String(evil) throws: toString is not a function

test("a value String() can't convert does not kill the whole file", () => {
  const rows = [
    { type: "custom-title", customTitle: evil },
    { type: "custom-title", customTitle: "ok" },
    { type: "user", uuid: "u", message: { content: [{ type: "tool_result", tool_use_id: "t", content: "x" }] }, toolUseResult: { task: { id: evil, subject: "s" } } },
    { type: "assistant", uuid: "a", message: { content: [{ type: "tool_use", id: "k", name: "AskUserQuestion", input: { questions: [{ question: "Q" }] } }] } },
    { type: "user", uuid: "b", message: { content: [{ type: "tool_result", tool_use_id: "k", content: "A" }] }, toolUseResult: { answers: { Q: evil } } },
  ];
  const idx = T.buildIndex(rows);
  T.computeStats(rows, idx);
  assert.equal(typeof T.describeRecord(rows[0], idx).summary, "string");
  assert.equal(typeof T.describeTool(rows[3].message.content[0], idx).body, "string");
});

test("an assistant message keeps its good blocks next to a broken one", () => {
  const items = T.planAssistantRecord({ type: "assistant", message: { content: [{ type: "text", text: "GOOD" }, null, { type: "text", text: 5 }] } });
  assert.deepEqual(items[0], { type: "text", text: "GOOD" });
  assert.equal(items.length, 2, "null is nothing to show; a text that is not a string is shown as unknown");
  assert.equal(items[1].type, "unknown");
  assert.equal(T.planAssistantRecord({ type: "assistant", message: { content: "plain" } })[0].text, "plain");
  assert.equal(T.planAssistantRecord({ type: "assistant", message: { content: [{ type: "thinking", thinking: ["x"] }] } })[0].type, "unknown");
  assert.equal(T.planAssistantRecord({ type: "assistant", message: { content: [{ type: "tool_use", id: "t", name: "Bash", input: {} }] } })[0].type, "tool_use");
});

test("a model fallback inside a reply is shown, not dropped", () => {
  const [it] = T.planAssistantRecord({
    type: "assistant",
    message: { content: [{ type: "fallback", from: { model: "claude-fable-5" }, to: { model: "claude-opus-4-8" } }] },
  });
  assert.equal(it.type, "fallback");
  assert.equal(it.summary, "claude-fable-5 → claude-opus-4-8");
});

test("unknown blocks and odd content in a user record are shown as unknown, not dropped", () => {
  const doc = T.planUserRecord({ type: "user", message: { content: [{ type: "document", source: { type: "base64" } }] } });
  assert.equal(doc.length, 1);
  assert.equal(doc[0].type, "unknown");
  const obj = T.planUserRecord({ type: "user", message: { content: { text: "HI" } } });
  assert.equal(obj.length, 1);
  assert.equal(obj[0].type, "unknown");
  assert.deepEqual(T.planUserRecord({ type: "user", message: { content: [] } }), []);
});

test("a tool reference in a result reads as the tool that was loaded", () => {
  assert.equal(T.blockText({ type: "tool_reference", tool_name: "WebFetch" }), "🔎 tool loaded: WebFetch");
});

test("cutting text never splits an emoji into a lone surrogate", () => {
  const lone = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const s = "a".repeat(79) + "😀z";
  assert.ok(!lone.test(T.safeSlice(s, 80)));
  assert.equal(T.safeSlice(s, 80), "a".repeat(79));
  assert.equal(T.safeSlice(s, 81), "a".repeat(79) + "😀");
  assert.ok(!lone.test(T.clip(s, 80)));
});

test("unknown content blocks are counted with the new record types", () => {
  const rows = [
    { type: "user", uuid: "u", message: { content: [{ type: "document", source: {} }] } },
    { type: "assistant", uuid: "a", message: { id: "m", content: [{ type: "redacted_thinking", data: "x" }, { type: "fallback", from: { model: "A" }, to: { model: "B" } }] } },
  ];
  assert.deepEqual(T.computeStats(rows).newTypes, ["content:document", "content:redacted_thinking"]);
});

test("blockText works as a map callback (map passes the index as the 2nd argument)", () => {
  const items = [{ type: "text", text: "A" }, { type: "document", source: {} }, { type: "text", text: "" }];
  const out = items.map(T.blockText);
  assert.equal(out[0], "A");
  assert.match(out[1], /document/);
});

test("a malformed known block is not reported as a new type", () => {
  const rows = [{ type: "assistant", uuid: "a", message: { id: "m", content: [{ type: "tool_use", name: 5 }, 7] } }];
  assert.deepEqual(T.computeStats(rows).newTypes, []);
});
