// Small features before folder mode (2026-10-26): diff of an Edit from the CLI's own
// structuredPatch, task cards linked across records, the resume command, token totals,
// an attachment type seen in the corpus.
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
    "\nreturn { describeRecord, buildIndex, computeStats, patchView, taskHint, resumeCommand, sessionUsage };",
)();

test("already_read_file is a known attachment: one line, the file unchanged", () => {
  const r = {
    type: "attachment",
    uuid: "a1",
    attachment: {
      type: "already_read_file",
      filename: "/p/research/sum.md",
      displayPath: "research/sum.md",
      content: { type: "file_unchanged", file: { filePath: "/p/research/sum.md" } },
    },
  };
  const s = T.describeRecord(r);
  assert.match(s.summary, /research\/sum\.md/);
  assert.match(s.summary, /unchanged/);
  assert.equal(s.body, null);
  assert.deepEqual(T.computeStats([r]).newTypes, []);
});

test("an Edit result with structuredPatch becomes a diff with +/- counts", () => {
  const tur = {
    filePath: "/p/src/a.py",
    structuredPatch: [
      { oldStart: 10, oldLines: 3, newStart: 10, newLines: 4, lines: [" keep", "-old", "+new 1", "+new 2", " tail"] },
      { oldStart: 40, oldLines: 1, newStart: 41, newLines: 0, lines: ["-gone"] },
    ],
  };
  const v = T.patchView(tur);
  assert.equal(v.file, "a.py");
  assert.equal(v.add, 2);
  assert.equal(v.del, 2);
  assert.deepEqual(
    v.lines.map((l) => l.t),
    ["@", " ", "-", "+", "+", " ", "@", "-"],
  );
  assert.equal(v.lines[0].s, "@@ -10,3 +10,4 @@");
  assert.equal(v.lines[3].s, "+new 1");
});

test("patchView refuses anything that is not a real patch", () => {
  for (const tur of [null, {}, { structuredPatch: "x" }, { structuredPatch: [] }, { structuredPatch: [{ lines: "no" }] }])
    assert.equal(T.patchView(tur), null, JSON.stringify(tur));
  // a non-string line is skipped, not printed as [object Object]
  const v = T.patchView({ filePath: "f", structuredPatch: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["+a", { x: 1 }] }] });
  assert.deepEqual(v.lines.map((l) => l.s), ["@@ -1,1 +1,1 @@", "+a"]);
});

test("TaskUpdate shows the task's subject, taken from the TaskCreate result in another record", () => {
  const rows = [
    {
      type: "assistant",
      uuid: "a",
      message: { content: [{ type: "tool_use", id: "c1", name: "TaskCreate", input: { subject: "Разбор API", description: "…" } }] },
    },
    {
      type: "user",
      uuid: "b",
      message: { content: [{ type: "tool_result", tool_use_id: "c1", content: "Task #7 created" }] },
      toolUseResult: { task: { id: "7", subject: "Разбор API" } },
    },
    {
      type: "assistant",
      uuid: "c",
      message: { content: [{ type: "tool_use", id: "u1", name: "TaskUpdate", input: { taskId: "7", status: "in_progress" } }] },
    },
  ];
  const idx = T.buildIndex(rows);
  assert.equal(T.taskHint(rows[0].message.content[0], idx), "#7 Разбор API");
  assert.equal(T.taskHint(rows[2].message.content[0], idx), "#7 → in_progress · Разбор API");
  // unknown task, no create seen: still says what changed
  assert.equal(T.taskHint({ name: "TaskUpdate", input: { taskId: "9", status: "completed" } }, idx), "#9 → completed");
  assert.equal(T.taskHint({ name: "Bash", input: {} }, idx), null);
});

test("resumeCommand quotes the path for the shell and refuses what it cannot quote", () => {
  const u = (extra) => ({ type: "user", uuid: "u", sessionId: "3f1c2b9e-0a4d-4c6e-9b7a-1d2e3f4a5b6c", cwd: "/home/u/my proj", ...extra });
  assert.equal(T.resumeCommand([u()]), "cd '/home/u/my proj' && claude --resume 3f1c2b9e-0a4d-4c6e-9b7a-1d2e3f4a5b6c");
  // only characters no shell reads specially (bash, zsh, fish, cmd, PowerShell): else no button
  for (const cwd of ["/home/u/it's", "/tmp/a\\';touch X;#", "/tmp/a & echo P & b", "/a/$(id)", "/a/`id`", "/a\u0085b", "C:\\dir\\", "/a|b", "/a;b"])
    assert.equal(T.resumeCommand([u({ cwd })]), null, cwd);
  assert.equal(T.resumeCommand([u({ cwd: "C:\\Users\\Имя\\proj-1" })]), "cd 'C:\\Users\\Имя\\proj-1' && claude --resume 3f1c2b9e-0a4d-4c6e-9b7a-1d2e3f4a5b6c");
  assert.equal(T.resumeCommand([u({ cwd: "/home/u/हिंदी_~@+=,:." })]) !== null, true);
  // a crafted transcript must not smuggle a command into what the human pastes
  assert.equal(T.resumeCommand([u({ sessionId: "x; rm -rf ~" })]), null);
  assert.equal(T.resumeCommand([u({ cwd: "/a\n/b" })]), null);
  // a subagent transcript has no session of its own to resume
  assert.equal(T.resumeCommand([u({ isSidechain: true })]), null);
  assert.equal(T.resumeCommand([{ type: "summary", summary: "x" }]), null);
});

test("sessionUsage counts each API message once, across streamed copies", () => {
  const a = (id, inp, out) => ({
    type: "assistant",
    message: { id, usage: { input_tokens: inp, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: out } },
  });
  const rows = [a("m1", 2, 10), a("m1", 2, 25), a("m2", 3, 5), { type: "user" }];
  assert.deepEqual(T.sessionUsage(rows), { input: 2 + 1100 + 3 + 1100, output: 30 });
  assert.equal(T.sessionUsage([{ type: "user" }]), null);
  // garbage numbers are ignored, not summed into NaN
  assert.deepEqual(T.sessionUsage([{ type: "assistant", message: { id: "x", usage: { input_tokens: "9", output_tokens: 4 } } }]), { input: 0, output: 4 });
});

test("task numbers that start over point to the task created last before the update", () => {
  const create = (id, cid, subject) => [
    { type: "assistant", uuid: "a" + cid, message: { content: [{ type: "tool_use", id: cid, name: "TaskCreate", input: { subject } }] } },
    { type: "user", uuid: "u" + cid, message: { content: [{ type: "tool_result", tool_use_id: cid, content: "ok" }] }, toolUseResult: { task: { id, subject } } },
  ];
  const update = (uid, id) => ({ type: "assistant", uuid: "a" + uid, message: { content: [{ type: "tool_use", id: uid, name: "TaskUpdate", input: { taskId: id, status: "completed" } }] } });
  const rows = [...create("1", "c1", "First"), update("x1", "1"), ...create("1", "c2", "Second"), update("x2", "1")];
  const idx = T.buildIndex(rows);
  assert.equal(T.taskHint(rows[2].message.content[0], idx), "#1 → completed · First");
  assert.equal(T.taskHint(rows[5].message.content[0], idx), "#1 → completed · Second");
});
