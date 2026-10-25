// Unit tests for the DOM-free triage section of index.html.
// Run: node --test test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("// ===== triage =====");
const end = html.indexOf("// ===== end triage =====");
assert.ok(start >= 0 && end > start, "triage section markers not found in index.html");
const T = new Function(
  html.slice(start, end) + "\nreturn { newTriage, triageLine, triageRecord, computeStats };",
)();

const lines = (tri, ...ls) => ls.forEach((l) => T.triageLine(tri, l));
const J = (o) => JSON.stringify(o);

test("api-request* lines are dropped, counted and sized in UTF-8 bytes", () => {
  const tri = T.newTriage();
  const api = '{"type":"api-request","id":"x","params":{"system":"Привет"}}';
  const blob = '{"type":"api-request-blob","hash":"h","message":{"role":"user","content":"secret"}}';
  const shape = '{"type":"api-request-shape","shape":{}}';
  lines(tri, api, blob, shape, J({ type: "user", uuid: "u1", message: { content: "hi" } }));
  assert.equal(tri.rows.length, 1);
  assert.equal(tri.rows[0].uuid, "u1");
  assert.equal(tri.apiReq, 3);
  const bytes = (s) => Buffer.byteLength(s, "utf8");
  assert.equal(tri.apiBytes, bytes(api) + bytes(blob) + bytes(shape));
  assert.ok(bytes(api) > api.length, "fixture must contain multi-byte characters");
});

test("api-request records arriving as objects (.json path) are dropped too", () => {
  const tri = T.newTriage();
  T.triageRecord(tri, { type: "api-request", id: "x" });
  T.triageRecord(tri, { type: "user", uuid: "u1" });
  assert.equal(tri.rows.length, 1);
  assert.equal(tri.apiReq, 1);
  assert.ok(tri.apiBytes > 0);
});

test("duplicate uuid keeps the first position and the latest copy", () => {
  const tri = T.newTriage();
  lines(
    tri,
    J({ type: "user", uuid: "a", slug: "old" }),
    J({ type: "assistant", uuid: "b" }),
    J({ type: "user", uuid: "a", slug: "new" }),
    J({ type: "user", uuid: "c" }),
  );
  assert.deepEqual(
    tri.rows.map((r) => r.uuid),
    ["a", "b", "c"],
  );
  assert.equal(tri.rows[0].slug, "new");
  assert.equal(tri.dups, 1);
});

test("CRLF line endings: api-request still dropped, records still parsed", () => {
  const tri = T.newTriage();
  lines(tri, '{"type":"api-request","id":"x"}\r', J({ type: "user", uuid: "u" }) + "\r");
  assert.equal(tri.apiReq, 1);
  assert.equal(tri.rows.length, 1);
});

test("api-request with unusual spacing is caught after parsing", () => {
  const tri = T.newTriage();
  const ln = '{ "type": "api-request", "id": "x" }';
  lines(tri, ln);
  assert.equal(tri.rows.length, 0);
  assert.equal(tri.apiReq, 1);
  assert.equal(tri.apiBytes, ln.length);
});

test("three copies of one uuid: first position, third content", () => {
  const tri = T.newTriage();
  lines(
    tri,
    J({ type: "user", uuid: "a", n: 1 }),
    J({ type: "user", uuid: "b" }),
    J({ type: "user", uuid: "a", n: 2 }),
    J({ type: "user", uuid: "a", n: 3 }),
  );
  assert.deepEqual(
    tri.rows.map((r) => r.uuid),
    ["a", "b"],
  );
  assert.equal(tri.rows[0].n, 3);
  assert.equal(tri.dups, 2);
});

test("an api-request carrying a known uuid never replaces the conversation record", () => {
  const tri = T.newTriage();
  lines(tri, J({ type: "user", uuid: "a", n: 1 }), '{"type":"api-request","uuid":"a"}');
  assert.equal(tri.rows[0].n, 1);
  assert.equal(tri.dups, 0);
});

test("records without uuid are never merged", () => {
  const tri = T.newTriage();
  lines(tri, J({ type: "last-prompt" }), J({ type: "last-prompt" }));
  assert.equal(tri.rows.length, 2);
  assert.equal(tri.dups, 0);
});

test("unparseable lines are counted, blank lines ignored, non-objects kept", () => {
  const tri = T.newTriage();
  lines(tri, "{broken", "   ", "null", J({ type: "user", uuid: "u" }));
  assert.equal(tri.bad, 1);
  assert.equal(tri.rows.length, 2);
  assert.equal(tri.rows[0], null);
});

test("computeStats: user count skips meta, tool results and compact summaries", () => {
  const rows = [
    { type: "user", message: { content: "real" } },
    { type: "user", isMeta: true, message: { content: "inject" } },
    { type: "user", toolUseResult: {}, message: { content: [] } },
    { type: "user", isCompactSummary: true, message: { content: "summary" } },
  ];
  assert.equal(T.computeStats(rows).nUser, 1);
});

test("computeStats: assistant count is per message.id, skipping synthetic API errors", () => {
  const rows = [
    { type: "assistant", uuid: "1", message: { id: "msg_A" } },
    { type: "assistant", uuid: "2", message: { id: "msg_A" } },
    { type: "assistant", uuid: "3", message: { id: "msg_B" } },
    { type: "assistant", uuid: "4", message: {} },
    { type: "assistant", uuid: "5", isApiErrorMessage: true, message: { id: "msg_C" } },
  ];
  assert.equal(T.computeStats(rows).nAsst, 3);
});

test("computeStats: assistant records with neither message.id nor uuid count one each", () => {
  const rows = [
    { type: "assistant", message: { content: "a" } },
    { type: "assistant", message: { content: "b" } },
    { type: "assistant" },
  ];
  assert.equal(T.computeStats(rows).nAsst, 3);
});

test("computeStats: service = typed records other than user/assistant/system; time span", () => {
  const rows = [
    { type: "user", timestamp: "2026-01-01T00:00:00Z" },
    { type: "system" },
    { type: "attachment" },
    { type: "permission-mode" },
    null,
    42,
    { type: "assistant", timestamp: "2026-01-02T00:00:00Z" },
  ];
  const s = T.computeStats(rows);
  assert.equal(s.nService, 2);
  assert.equal(s.firstTs, "2026-01-01T00:00:00Z");
  assert.equal(s.lastTs, "2026-01-02T00:00:00Z");
});
