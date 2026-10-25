// Regression tests for the "liar" review (2026-10-25): places where the feed said
// something the data does not — machine text signed as the human, the human's words
// lost, a timeout shown as an answer, base64 in an @-attached image.
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
    "\nreturn { describeRecord, describeTool, buildIndex, computeStats, planUserRecord, imageInfo };",
)();

const queued = (prompt, extra = {}) => ({
  type: "attachment",
  uuid: "q" + prompt.length,
  attachment: { type: "queued_command", commandMode: "prompt", prompt, ...extra },
});
const user = (content, extra = {}) => ({ type: "user", uuid: extra.uuid ?? "u1", message: { role: "user", content }, ...extra });
const humanItems = (r, idx) => T.planUserRecord(r, idx).filter((x) => x.type === "text" && (x.spec === null || x.spec?.human));

test("a subagent report delivered as queued_command is a report, not the human", () => {
  const rows = [
    user([{ type: "tool_result", tool_use_id: "t1", content: "launched" }], { uuid: "u0", toolUseResult: { agentId: "a1", description: "Fix the tests" } }),
    queued('<agent-message from="a1">\n[Subagent hand-back] The report follows:\n  All 12 tests pass.\n</agent-message>', {
      origin: { kind: "peer", from: "a1", handback: true },
    }),
  ];
  const s = T.describeRecord(rows[1], T.buildIndex(rows));
  assert.notEqual(s.kind, "user");
  assert.match(s.kind, /report/);
  assert.match(s.summary, /Fix the tests/);
  assert.match(s.body, /All 12 tests pass/);
  assert.equal(T.computeStats(rows).nUser, 0);
});

test("a message from another session is not the human either", () => {
  const r = queued('<cross-session-message from="uds:/run/x.sock" from-name="architect-55">Принял, перенос ждёт</cross-session-message>', {
    origin: { kind: "peer", name: "architect-55" },
  });
  const s = T.describeRecord(r, T.buildIndex([r]));
  assert.notEqual(s.kind, "user");
  assert.match(s.summary, /architect-55/);
  assert.equal(T.computeStats([r]).nUser, 0);
});

test("queued prompts from a coordinator, a task or a meta record are not the human", () => {
  for (const r of [
    queued("continue with step 2", { origin: { kind: "coordinator" } }),
    queued("note", { origin: { kind: "task-notification" } }),
    { ...queued("injected"), isMeta: true },
  ])
    assert.equal(T.computeStats([r]).nUser, 0, JSON.stringify(r));
  assert.equal(T.computeStats([queued("typed by me", { origin: { kind: "human" } })]).nUser, 1);
});

test("the human's words in a declined tool call are a message of theirs", () => {
  const said = "подтверди аудитом что команда не делает лишнее";
  const text = `The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). To tell you how to proceed, the user said:\n${said}`;
  for (const content of [text, [{ type: "text", text }]]) {
    const r = user([{ type: "tool_result", tool_use_id: "t9", content, is_error: true }]);
    const idx = T.buildIndex([r]);
    const items = humanItems(r, idx);
    assert.equal(items.length, 1);
    assert.equal(items[0].spec?.body ?? items[0].text, said);
    assert.ok(T.planUserRecord(r, idx).some((x) => x.type === "result"), "the result itself stays");
    assert.equal(T.computeStats([r]).nUser, 1);
  }
  const plain = user([{ type: "tool_result", tool_use_id: "t9", content: "The user doesn't want to proceed with this tool use.", is_error: true }]);
  assert.equal(T.computeStats([plain]).nUser, 0);
});

test("an AskUserQuestion that timed out says so and marks the selection as a draft", () => {
  const q = "Which cost format?";
  const rows = [
    { type: "assistant", uuid: "a", message: { content: [{ type: "tool_use", id: "k1", name: "AskUserQuestion", input: { questions: [{ question: q }] } }] } },
    user([{ type: "tool_result", tool_use_id: "k1", content: `No response after 60s — the user may be away from keyboard. Proceed using your best judgment.\n\nBefore going idle the user had selected: "${q}"="by supply"` }], {
      uuid: "b",
      toolUseResult: { answers: { [q]: "by supply" }, afkTimeoutMs: 60000 },
    }),
  ];
  const idx = T.buildIndex(rows);
  const s = T.describeTool(rows[0].message.content[0], idx);
  assert.match(s.body, /⏱/);
  assert.match(s.body, /no answer/i);
  assert.match(s.body, /by supply/);
  assert.match(s.body, /draft/i);
});

test("the first record of a subagent transcript is the parent's task, not the human", () => {
  const r = user("Research ASR systems for Russian. Read only.", { uuid: "s1", isSidechain: true, parentUuid: null, agentId: "a1" });
  const [it] = T.planUserRecord(r, T.buildIndex([r]));
  assert.ok(it.spec, "classified");
  assert.equal(it.spec.who, "parent");
  assert.equal(it.spec.prose, true); // still readable in reader mode
  assert.equal(T.computeStats([r]).nUser, 0);
  // the first record of a main session is the human's
  assert.equal(T.computeStats([user("hello", { isSidechain: false, parentUuid: null })]).nUser, 1);
});

test("a fork's directive after <fork-boilerplate> is the parent's, not the human's", () => {
  const r = user("<fork-boilerplate>\nYou are a worker fork.\n</fork-boilerplate>\n\nCheck the docs folder.", { parentUuid: "p" });
  const [it] = T.planUserRecord(r, T.buildIndex([r]));
  assert.equal(it.spec?.who, "parent");
  assert.equal(T.computeStats([r]).nUser, 0);
});

test("the CLI's 'Tool loaded.' next to a ToolSearch result is not the human", () => {
  const r = user([
    { type: "tool_result", tool_use_id: "t", content: [{ type: "tool_reference", tool_name: "WebFetch" }] },
    { type: "text", text: "Tool loaded." },
  ]);
  assert.equal(T.computeStats([r]).nUser, 0);
});

test("an image attached with @file is an image, not a base64 dump", () => {
  const data = "/9j/4AAQSkZJRgABAQ" + "A".repeat(4000);
  const r = {
    type: "attachment",
    uuid: "f1",
    attachment: { type: "file", filename: "/p/docs/img/1.jpg", displayPath: "docs/img/1.jpg", content: { type: "image", file: { base64: data, type: "image/jpeg", originalSize: 3000 } } },
  };
  const s = T.describeRecord(r);
  assert.equal(typeof s.body, "string");
  assert.ok(!s.body.includes("/9j/4AAQ"), s.body.slice(0, 80));
  assert.match(s.body, /image\/jpeg/);
  assert.equal(s.images?.length, 1);
  assert.equal(T.imageInfo(s.images[0]).ok, true);
});

test("popAll matches whole messages, not a substring inside a word", () => {
  const q = (operation, content) => ({ type: "queue-operation", operation, content });
  const rows = [q("enqueue", "да"), q("popAll", "когда подумаю")];
  const idx = T.buildIndex(rows);
  assert.equal(idx.queueShown.get(rows[0]), "sent");
  const rows2 = [q("enqueue", "да"), q("popAll", "да\nещё вот что")];
  assert.equal(T.buildIndex(rows2).queueShown.get(rows2[0]), "returned");
});
