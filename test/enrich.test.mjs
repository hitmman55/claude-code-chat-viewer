// Unit tests for tool-result enrichment (phase 5'): base64 images (owner decision 2),
// <persisted-output> results, subagent run stats.
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
    "\nreturn { imageInfo, blockText, persistedInfo, agentStats, taskNoteSummary, describeRecord, planUserRecord, computeStats, buildIndex };",
)();

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const img = (data = PNG, media_type = "image/png", type = "base64") => ({ type: "image", source: { type, media_type, data } });

test("a base64 png becomes a data: URI built by code", () => {
  const i = T.imageInfo(img());
  assert.equal(i.ok, true);
  assert.equal(i.src, `data:image/png;base64,${PNG}`);
  assert.match(i.label, /image\/png/);
});

test("only known raster types are rendered — svg, url sources and odd data are labels", () => {
  for (const b of [
    img(PNG, "image/svg+xml"),
    img(PNG, "text/html"),
    img("https://example.com/x.png", "image/png", "url"),
    img('AAAA" onerror="alert(1)', "image/png"),
    { type: "image", source: { type: "base64", media_type: "image/png" } }, // no data
    { type: "image" },
    { type: "image", source: "garbage" },
  ]) {
    const i = T.imageInfo(b);
    assert.equal(i.ok, false, JSON.stringify(b));
    assert.equal(i.src, null);
    assert.equal(typeof i.label, "string");
  }
});

test("copy/summary text of an image is its label, never the base64", () => {
  const t = T.blockText(img());
  assert.ok(!t.includes(PNG.slice(0, 20)), t);
  assert.match(t, /image\/png/);
  assert.equal(T.blockText({ type: "text", text: "hello" }), "hello");
  assert.equal(T.blockText("raw"), "raw");
  assert.equal(T.blockText({ type: "tool_reference", tool_name: "Bash" }), JSON.stringify({ type: "tool_reference", tool_name: "Bash" }, null, 2));
});

test("PDF pages injected by Read are an image item of the record, not a human message", () => {
  const r = { type: "user", uuid: "p", isMeta: true, message: { role: "user", content: [img(), img()] } };
  const plan = T.planUserRecord(r, T.buildIndex([r]));
  assert.equal(plan.length, 1);
  assert.equal(plan[0].type, "images");
  assert.equal(plan[0].blocks.length, 2);
  assert.equal(plan[0].meta, true);
  assert.equal(T.computeStats([r]).nUser, 0);
});

test("an image a human pasted (not meta) counts as their message", () => {
  const r = { type: "user", uuid: "h", message: { role: "user", content: [img()] } };
  const plan = T.planUserRecord(r, T.buildIndex([r]));
  assert.equal(plan[0].meta, false);
  assert.equal(T.computeStats([r]).nUser, 1);
});

test("persisted output: size and path of the full file are read from the header", () => {
  const text =
    "<persisted-output>\nOutput too large (52.4KB). Full output saved to: /home/u/.claude/projects/p/s/tool-results/toolu_01.txt\n\nPreview (first 2KB):\n> hello";
  assert.deepEqual(T.persistedInfo(text), { size: "52.4KB", path: "/home/u/.claude/projects/p/s/tool-results/toolu_01.txt" });
  assert.equal(T.persistedInfo("plain output"), null);
  assert.equal(T.persistedInfo("see <persisted-output> later"), null);
  assert.deepEqual(T.persistedInfo("<persisted-output>\nsomething new"), { size: null, path: null });
});

test("persisted header parsing is linear on hostile input", () => {
  const t0 = performance.now();
  T.persistedInfo("<persisted-output>\nOutput too large (" + "(".repeat(200000));
  assert.ok(performance.now() - t0 < 200);
});

test("subagent run stats from toolUseResult", () => {
  assert.equal(
    T.agentStats({ agentId: "a1", status: "completed", totalTokens: 48210, totalDurationMs: 125000, totalToolUseCount: 17 }),
    "🤖 48k tokens · 2m 5s · 17 tools",
  );
  assert.equal(T.agentStats({ agentId: "a1", totalTokens: "x" }), null);
  assert.equal(T.agentStats({ stdout: "" }), null);
  assert.equal(T.agentStats("error text"), null);
  assert.equal(T.agentStats(null), null);
});

const note = (usage, status = "completed", extra = "") =>
  `<task-notification>\n<task-id>a1</task-id>\n<status>${status}</status>\n<summary>Agent "Format changes" finished</summary>\n${extra}<usage>${usage}</usage>\n</task-notification>`;

test("background subagent: the finish notification gives task, tokens, time, tools", () => {
  const want = 'Agent "Format changes" finished · 🤖 243k tokens · 12m 1s · 42 tools';
  for (const u of [
    "<subagent_tokens>242772</subagent_tokens><tool_uses>42</tool_uses><duration_ms>720995</duration_ms>",
    "subagent_tokens: 242772\ntool_uses: 42\nduration_ms: 720995",
    "total_tokens: 242772\ntool_uses: 42\nduration_ms: 720995",
    "<total_tokens>242772</total_tokens><tool_uses>42</tool_uses><duration_ms>720995</duration_ms>",
  ])
    assert.equal(T.taskNoteSummary(note(u)), want, u);
});

test("a failed or killed task says so", () => {
  assert.match(T.taskNoteSummary(note("total_tokens: 10", "failed")), /⚠ failed/);
  assert.doesNotMatch(T.taskNoteSummary(note("total_tokens: 10")), /completed/);
});

test("usage quoted inside the result does not win over the real one", () => {
  const t = note("<subagent_tokens>5000</subagent_tokens>", "completed", "<result>the doc says <usage><subagent_tokens>1</subagent_tokens></usage></result>\n");
  assert.match(T.taskNoteSummary(t), /5k tokens/);
});

test("not a task notification → null; queued_command notifications use the same summary", () => {
  assert.equal(T.taskNoteSummary("hello"), null);
  const s = T.describeRecord({ type: "attachment", attachment: { type: "queued_command", commandMode: "task-notification", prompt: note("total_tokens: 1500") } });
  assert.match(s.summary, /^Agent "Format changes" finished · 🤖 2k tokens/);
});
