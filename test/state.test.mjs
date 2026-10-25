// Unit tests for state records and the message queue (phase 4'): repeated state
// values are shown only when they change; a queued message appears once, where it
// actually reached the conversation. All cross-record facts come from buildIndex,
// which render() rebuilds for every file.
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
  section("triage") + section("rules") + "\nreturn { describeRecord, buildIndex, computeStats };",
)();

const shown = (rows) => {
  const idx = T.buildIndex(rows);
  return rows
    .map((r) => [r, T.describeRecord(r, idx)])
    .filter(([r, s]) => r.type !== "user" && r.type !== "assistant" && !s.hide);
};
const pm = (mode) => ({ type: "permission-mode", permissionMode: mode, sessionId: "s" });
const q = (operation, content) => ({ type: "queue-operation", operation, timestamp: "2026-10-25T10:00:00Z", ...(content !== undefined && { content }) });
const queued = (prompt) => ({
  type: "attachment",
  uuid: "a" + prompt.length,
  attachment: { type: "queued_command", prompt, commandMode: "prompt" },
});

test("a repeated permission mode is shown once, a change shows old → new", () => {
  const out = shown([pm("default"), pm("default"), pm("plan"), pm("plan"), pm("plan"), pm("default")]);
  assert.deepEqual(
    out.map(([, s]) => s.summary),
    ["default", "default → plan", "plan → default"],
  );
});

test("each state record type is tracked on its own", () => {
  const out = shown([
    { type: "custom-title", customTitle: "viewer" },
    { type: "ai-title", aiTitle: "Update viewer" },
    { type: "agent-name", agentName: "viewer" },
    { type: "custom-title", customTitle: "viewer" },
    { type: "ai-title", aiTitle: "Update viewer" },
    { type: "agent-name", agentName: "viewer" },
    { type: "custom-title", customTitle: "viewer 2" },
  ]);
  assert.deepEqual(
    out.map(([r, s]) => `${r.type}:${s.summary}`),
    ["custom-title:viewer", "ai-title:Update viewer", "agent-name:viewer", "custom-title:viewer → viewer 2"],
  );
});

test("a permission mode change is a system line, not UI noise", () => {
  const [[, s]] = shown([pm("plan")]);
  assert.equal(s.kind, "system");
});

test("without an index a state record is still shown (nothing silently dropped)", () => {
  assert.equal(T.describeRecord(pm("plan")).hide, undefined);
});

test("a queued message delivered later is shown only where it was delivered", () => {
  const out = shown([q("enqueue", "fix the test"), q("remove", "fix the test"), queued("fix the test")]);
  assert.equal(out.length, 1);
  assert.equal(out[0][0].type, "attachment");
});

test("whitespace differences do not break the delivery match", () => {
  const out = shown([q("enqueue", "fix  the\ntest "), queued("fix the test")]);
  assert.equal(out.length, 1);
});

test("a queued shell command or slash command is matched to its delivered form", () => {
  const u = (content) => ({ type: "user", uuid: "u" + content.length, message: { role: "user", content } });
  assert.equal(shown([q("enqueue", "ls -la"), u("<bash-input>ls -la</bash-input>")]).length, 0);
  assert.equal(
    shown([
      q("enqueue", "/model claude-fable-5"),
      u("<command-name>/model</command-name>\n<command-message>model</command-message>\n<command-args>claude-fable-5</command-args>"),
    ]).length,
    0,
  );
  assert.equal(shown([q("enqueue", "/usage"), u("<command-name>/usage</command-name>\n<command-args></command-args>")]).length, 0);
  const local = { type: "system", subtype: "local_command", content: "<command-name>/resume</command-name>\n<command-args></command-args>" };
  assert.deepEqual(shown([q("enqueue", "/resume"), local]).map(([r]) => r.type), ["system"]);
});

test("old CLI: text that exists only in the queue is shown as the human's message", () => {
  // CLI ≤ 2.1.9x: enqueue carries the text, remove is empty, nothing else records it.
  const out = shown([q("enqueue", "Answer to question 1"), q("remove")]);
  assert.equal(out.length, 1);
  const [r, s] = out[0];
  assert.equal(r.operation, "enqueue");
  assert.equal(s.kind, "user");
  assert.equal(s.prose, true);
  assert.equal(s.body, "Answer to question 1");
});

test("the same queued text is shown once even when several queue records carry it", () => {
  const out = shown([q("enqueue", "only here"), q("remove", "only here")]);
  assert.equal(out.length, 1);
});

test("text pulled back to the input box (popAll) is not shown as a sent message", () => {
  const out = shown([q("enqueue", "do not open new agents"), q("popAll", "do not open new agents")]);
  assert.equal(out.length, 1);
  const [, s] = out[0];
  assert.notEqual(s.kind, "user");
  assert.equal(s.prose, false);
  assert.match(s.body, /do not open new agents/);
  assert.match(s.tag, /↩/);
});

test("machine notifications in the queue are hidden — they arrive as their own records", () => {
  for (const c of [
    "<task-notification>\n<task-id>b1</task-id>\n</task-notification>",
    '<agent-message from="x">\n  done\n</agent-message>',
    '<cross-session-message from="uds:/run/x.sock">hi</cross-session-message>',
  ])
    assert.equal(shown([q("enqueue", c), q("remove", c)]).length, 0, c);
});

test("dequeue and empty queue records are hidden", () => {
  assert.equal(shown([q("dequeue"), q("remove"), q("popAll", "")]).length, 0);
});

test("the user count agrees with the queue: delivered prompts and queue-only text count once", () => {
  const rows = [
    q("enqueue", "a"),
    queued("a"), // delivered → counted via queued_command
    q("enqueue", "b"),
    q("remove"), // old CLI → counted via the queue record
    q("enqueue", "c"),
    q("popAll", "c"), // pulled back → not sent
  ];
  assert.equal(T.computeStats(rows).nUser, 2);
});

test("a queued_command task notification is not a human message", () => {
  const rows = [{ type: "attachment", attachment: { type: "queued_command", prompt: "<task-notification>x</task-notification>", commandMode: "task-notification" } }];
  assert.equal(T.computeStats(rows).nUser, 0);
});
