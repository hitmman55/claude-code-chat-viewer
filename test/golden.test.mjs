// Golden snapshot of classification: every record of demo.jsonl and of a synthetic
// set (one record per rule, unknown types, broken lines) → [kind, who, tag, summary].
// Catches unintended changes to which bucket a record lands in and how it is labelled.
// Intended change: UPDATE_GOLDEN=1 node --test test/golden.test.mjs, then review the diff.
// Run: node --test test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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
    "\nreturn { newTriage, triageLine, buildIndex, computeStats, describeRecord, describeTool, planUserRecord, clip, SYSTEM_RULES, ATTACHMENT_RULES, RECORD_RULES };",
)();
const GOLDEN = new URL("./fixtures/golden.json", import.meta.url);

// Fields many rules read; each synthetic record carries all of them.
const COMMON = {
  content: "sample content",
  text: "sample text",
  prompt: "sample prompt",
  hookName: "PreToolUse:Bash",
  hookEvent: "PreToolUse",
  exitCode: 1,
  durationMs: 1234,
  command: "./hook.sh",
  level: "warning",
  timestamp: "2026-10-25T10:00:00.000Z",
};
function syntheticLines() {
  const out = [];
  for (const sub of Object.keys(T.SYSTEM_RULES)) out.push({ type: "system", subtype: sub, uuid: `s-${sub}`, ...COMMON });
  for (const sub of Object.keys(T.ATTACHMENT_RULES))
    out.push({ type: "attachment", uuid: `a-${sub}`, attachment: { type: sub, ...COMMON }, timestamp: COMMON.timestamp });
  for (const t of Object.keys(T.RECORD_RULES)) out.push({ type: t, ...COMMON, operation: "enqueue" });
  out.push({ type: "system", subtype: "future_subtype", uuid: "s-future", content: "new" });
  out.push({ type: "attachment", uuid: "a-future", attachment: { type: "future_attachment", n: 1 } });
  out.push({ type: "future-record", x: 1 });
  return [
    ...out.map((r) => JSON.stringify(r)),
    "{ not json",
    "",
    '{"type":"api-request","request":{"model":"x"}}',
    "[1, 2, 3]",
  ];
}

function classify(lines) {
  const tri = T.newTriage();
  for (const ln of lines) T.triageLine(tri, ln);
  const rows = tri.rows;
  const idx = T.buildIndex(rows);
  const out = [];
  for (const r of rows) {
    if (r.type === "user") {
      for (const it of T.planUserRecord(r, idx)) {
        if (it.type === "result") out.push(["tool-result", "result", null, T.clip(JSON.stringify(it.block.content), 60)]);
        else if (it.type === "images") out.push([it.meta ? "meta" : "user", "images", null, String(it.blocks.length)]);
        else if (!it.spec) out.push(["user", "user", null, T.clip(it.text, 60)]);
        else if (it.spec.legacy) out.push([it.spec.legacy, null, null, T.clip(it.text, 60)]);
        else out.push([it.spec.kind, it.spec.who, it.spec.tag, it.spec.summary ?? null]);
      }
    } else if (r.type === "assistant") {
      const c = r.message?.content;
      for (const b of Array.isArray(c) ? c : [{ type: "text", text: String(c) }]) {
        if (b.type === "tool_use") {
          const s = T.describeTool(b, idx);
          out.push(s ? [s.kind, s.who, s.tag, T.clip(s.body, 60)] : ["tool-use", b.name, null, null]);
        } else out.push([b.type, "claude", null, T.clip(b.text ?? b.thinking ?? "", 60)]);
      }
    } else {
      const s = T.describeRecord(r, idx);
      out.push(s.hide ? ["hidden", r.type, null, null] : [s.kind, s.who, s.tag, s.summary]);
    }
  }
  const st = T.computeStats(rows, idx);
  return { stats: { ...st, bad: tri.bad, dups: tri.dups, apiReq: tri.apiReq }, entries: out };
}

test("classification matches the golden snapshot", () => {
  const demo = readFileSync(new URL("../demo.jsonl", import.meta.url), "utf8").split("\n");
  const actual = { demo: classify(demo), synthetic: classify(syntheticLines()) };
  if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, JSON.stringify(actual, null, 1) + "\n");
    assert.ok(process.env.UPDATE_GOLDEN, "golden snapshot was missing — written, review and commit it");
    return;
  }
  assert.deepEqual(actual, JSON.parse(readFileSync(GOLDEN, "utf8")));
});
