// Unit tests for the DOM-free rule tables of index.html (phase 2').
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
    "\nreturn { describeRecord, describeTool, computeStats, SYSTEM_RULES, ATTACHMENT_RULES, RECORD_RULES };",
)();

const att = (a, extra = {}) => ({ type: "attachment", uuid: "u", attachment: a, ...extra });
const bodyText = (spec) => (typeof spec.body === "string" ? spec.body : JSON.stringify(spec.body?.json));

test("every rule survives a record that has nothing but its type", () => {
  for (const sub of Object.keys(T.SYSTEM_RULES)) T.describeRecord({ type: "system", subtype: sub });
  for (const sub of Object.keys(T.ATTACHMENT_RULES)) T.describeRecord(att({ type: sub }));
  for (const t of Object.keys(T.RECORD_RULES)) T.describeRecord({ type: t });
});

test("rule output is plain data: summary and body are strings or {json}", () => {
  const all = [
    ...Object.keys(T.SYSTEM_RULES).map((s) => ({ type: "system", subtype: s })),
    ...Object.keys(T.ATTACHMENT_RULES).map((s) => att({ type: s })),
    ...Object.keys(T.RECORD_RULES).map((t) => ({ type: t })),
  ];
  for (const r of all) {
    const s = T.describeRecord(r);
    if (s.hide) continue;
    assert.ok(s.summary == null || typeof s.summary === "string", JSON.stringify(r));
    assert.ok(s.body == null || typeof s.body === "string" || "json" in s.body, JSON.stringify(r));
    assert.equal(typeof s.kind, "string");
    assert.equal(typeof s.tag, "string");
  }
});

test("hook_blocking_error goes to the hooks bucket with the blocking text", () => {
  const s = T.describeRecord(
    att({
      type: "hook_blocking_error",
      hookName: "Stop",
      hookEvent: "Stop",
      blockingError: { blockingError: "fix FILES.md first", command: "python3 hook.py" },
    }),
  );
  assert.equal(s.kind, "hook error");
  assert.match(s.tag, /hook_blocking_error/);
  assert.match(bodyText(s), /fix FILES\.md first/);
  assert.equal(s.level, "known");
});

test("unknown attachment with rendered[] is recognized and shows the rendered text", () => {
  const s = T.describeRecord(
    att(
      { type: "brand_new_thing" },
      { rendered: [{ content: "<system-reminder>\nHello from the CLI\n</system-reminder>" }] },
    ),
  );
  assert.equal(s.level, "recognized");
  assert.equal(s.body, "Hello from the CLI");
  assert.match(s.tag, /brand_new_thing/);
});

test("unknown attachment with a typical text field is recognized", () => {
  const s = T.describeRecord(att({ type: "brand_new_thing", text: "plain text" }));
  assert.equal(s.level, "recognized");
  assert.equal(s.body, "plain text");
});

test("unknown attachment without any text is shown as JSON and marked unknown", () => {
  const s = T.describeRecord(att({ type: "brand_new_thing", n: 1 }));
  assert.equal(s.level, "unknown");
  assert.deepEqual(s.body.json, { type: "brand_new_thing", n: 1 });
});

test("unknown top-level type and unknown system subtype are marked unknown", () => {
  assert.equal(T.describeRecord({ type: "future-record", x: 1 }).level, "unknown");
  assert.equal(T.describeRecord({ type: "system", subtype: "future_sub" }).level, "unknown");
});

test("noise records are hidden", () => {
  for (const r of [
    att({ type: "total_tokens_reminder", text: "<total_tokens>1</total_tokens>" }),
    att({ type: "credential_org", organizationUuid: "x" }),
    att({ type: "task_reminder", content: [], itemCount: 0 }),
    { type: "mode", mode: "normal" },
    { type: "atis-latch", atis: "" },
    { type: "last-prompt", leafUuid: "x" },
    { type: "agent-setting" },
  ])
    assert.equal(T.describeRecord(r).hide, true, JSON.stringify(r));
});

test("compact_boundary is a divider with the token drop in the summary", () => {
  const s = T.describeRecord({
    type: "system",
    subtype: "compact_boundary",
    content: "Conversation compacted",
    compactMetadata: { trigger: "auto", preTokens: 771000, postTokens: 11000, durationMs: 168000 },
  });
  assert.equal(s.divider, true);
  assert.match(s.summary, /auto/);
  assert.match(s.summary, /771k → 11k/);
});

test("queued_command: prompt is a user message, anything else is a task note", () => {
  const q = (mode) => T.describeRecord(att({ type: "queued_command", prompt: "do X", commandMode: mode }));
  assert.equal(q("prompt").kind, "user");
  assert.equal(q("prompt").prose, true);
  assert.equal(q("prompt").body, "do X");
  assert.equal(q("task-notification").kind, "task-note");
  assert.equal(q("something-new").kind, "task-note");
  assert.equal(q(undefined).kind, "task-note");
});

test("sensitive attachments never put their contents into the summary", () => {
  const secret = "hitmman@example.com /home/someone/private";
  const cases = [
    att({ type: "session_context", context: { userEmail: secret } }),
    att({ type: "prompt_snapshot", systemPrompt: [secret, secret] }),
    att({ type: "instructions", files: [{ path: "/x/CLAUDE.md", content: secret }] }),
    att({ type: "environment", snapshot: { workingDirectory: secret, platform: "linux", shell: "bash" } }),
  ];
  for (const r of cases) {
    const s = T.describeRecord(r);
    assert.equal(s.sensitive, true, r.attachment.type);
    assert.ok(!String(s.summary ?? "").includes("hitmman"), r.attachment.type);
  }
});

test("SubagentHandback is shown as the subagent's report", () => {
  const s = T.describeTool({ type: "tool_use", name: "SubagentHandback", input: { message: "## Report\nall done" } });
  assert.equal(s.prose, true);
  assert.equal(s.kind, "assistant");
  assert.equal(s.body, "## Report\nall done");
  assert.equal(T.describeTool({ type: "tool_use", name: "Bash", input: { command: "ls" } }), null);
});

test("computeStats lists record types that have no rule", () => {
  const rows = [
    { type: "user" },
    att({ type: "hook_success" }),
    att({ type: "brand_new_thing" }),
    att({ type: "brand_new_thing" }),
    { type: "system", subtype: "turn_duration" },
    { type: "system", subtype: "future_sub" },
    { type: "future-record" },
    { type: "permission-mode" },
  ];
  assert.deepEqual(T.computeStats(rows).newTypes, [
    "attachment:brand_new_thing",
    "future-record",
    "system:future_sub",
  ]);
});

// --- adversarial review of c030c13 ---

test("local_command summary stays linear on a wall of unclosed tags", () => {
  const content = "<command-name>".repeat(40000);
  const t0 = performance.now();
  T.describeRecord({ type: "system", subtype: "local_command", content });
  assert.ok(performance.now() - t0 < 500, "commandSummary must not backtrack");
});

test("local_command summary still extracts name and args", () => {
  const s = T.describeRecord({
    type: "system",
    subtype: "local_command",
    content: "<command-name>/rename</command-name>\n<command-args>viewer</command-args>",
  });
  assert.equal(s.summary, "/rename · viewer");
});

test("object-shaped fields given as strings are not split into characters", () => {
  const big = "x".repeat(2_000_000);
  const t0 = performance.now();
  const snap = T.describeRecord({ type: "file-history-snapshot", snapshot: { trackedFileBackups: big } });
  const ctx = T.describeRecord({ type: "attachment", attachment: { type: "session_context", context: "abc" } });
  assert.ok(performance.now() - t0 < 500);
  assert.equal(snap.summary, "0 files");
  assert.equal(ctx.summary, null);
});

test("prototype keys never leak into badges", () => {
  for (const level of ["constructor", "__proto__", "toString"]) {
    const s = T.describeRecord({ type: "system", subtype: "informational", level, content: "x" });
    assert.ok(!/function|\[object/.test(s.tag), s.tag);
  }
});
