// Unit tests for user-record classification (phase 3'): wrapper tags, markers,
// compact echo, skill injections, subagent reports, AskUserQuestion cards, and
// the user-message count that must agree with what the feed shows.
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
    "\nreturn { describeUser, describeTool, buildIndex, computeStats, planUserRecord };",
)();

const EMPTY = T.buildIndex([]);
const user = (content, extra = {}) => ({ type: "user", uuid: extra.uuid ?? "u1", message: { role: "user", content }, ...extra });
const d = (r, idx = EMPTY) => {
  const c = r.message.content;
  const text = typeof c === "string" ? c : c.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return T.describeUser(r, text, idx);
};

test("a plain human message is not classified", () => {
  assert.equal(d(user("Начинай фазу 1")), null);
  assert.equal(d(user([{ type: "text", text: "фаза 2" }])), null);
});

test("an unknown leading tag stays a human message", () => {
  assert.equal(d(user("<foo>looks like a tag</foo> but typed by a human")), null);
});

test("task notifications keep the existing task-note rendering", () => {
  // real notifications are always closed (1331 of 1331 in the corpus)
  assert.equal(d(user("<task-notification>\n<task-id>x</task-id>\n</task-notification>")).legacy, "task");
});

test("slash command record becomes a system line with name and args", () => {
  const s = d(
    user(
      "<command-name>/compact</command-name>\n            <command-message>compact</command-message>\n            <command-args>не сохраняй ничего</command-args>",
    ),
  );
  assert.equal(s.kind, "system");
  assert.equal(s.summary, "/compact · не сохраняй ничего");
});

test("command-message first (plugin skills) is a command too", () => {
  const s = d(user("<command-message>superpowers:brainstorm</command-message>\n<command-name>/superpowers:brainstorm</command-name>"));
  assert.equal(s.kind, "system");
});

test("local command output: system, ANSI escapes stripped", () => {
  const s = d(user("<local-command-stdout>\u001b[2mCompacted (ctrl+o to see full summary)\u001b[22m</local-command-stdout>"));
  assert.equal(s.kind, "system");
  assert.equal(s.body, "Compacted (ctrl+o to see full summary)");
  assert.ok(!s.summary.includes("\u001b"));
});

test("! shell input is a tool call, its output a tool result; stderr marks an error", () => {
  const inp = d(user("<bash-input>git status</bash-input>"));
  assert.equal(inp.kind, "tool-use");
  assert.equal(inp.body, "git status");
  const ok = d(user("<bash-stdout>clean</bash-stdout><bash-stderr></bash-stderr>"));
  assert.equal(ok.kind, "tool-result");
  assert.equal(ok.body, "clean");
  const bad = d(user("<bash-stdout></bash-stdout><bash-stderr>fatal: not a repo</bash-stderr>"));
  assert.equal(bad.kind, "tool-result error");
  assert.match(bad.body, /fatal: not a repo/);
});

test("a bare system-reminder in a user record is collapsible meta, never hidden", () => {
  const s = d(user("<system-reminder>\nnote\n</system-reminder>"));
  assert.equal(s.kind, "meta");
  assert.ok(!s.hide);
  assert.match(s.body, /note/);
});

test("system-reminder followed by live text: the whole record is the human's message", () => {
  assert.equal(d(user("<system-reminder>\nnote\n</system-reminder>\nи мой текст")), null);
});

test("interruption markers: only the exact whole text", () => {
  for (const m of ["[Request interrupted by user]", "[Request interrupted by user for tool use]", "[Request interrupted]"]) {
    const s = d(user([{ type: "text", text: m }]));
    assert.equal(s.kind, "meta", m);
    assert.match(s.tag, /interrupted/);
  }
  assert.equal(d(user("я написал [Request interrupted by user] в цитате")), null);
});

test("compact echo is hidden only when it is a leaf followed by a manual compact", () => {
  const echo = user("/compact не сохраняй ничего", { uuid: "e" });
  const boundary = { type: "system", subtype: "compact_boundary", uuid: "b", compactMetadata: { trigger: "manual" } };
  const cmd = user("<command-name>/compact</command-name>\n<command-args>не сохраняй ничего</command-args>", { uuid: "cmd" });
  const idx = T.buildIndex([echo, boundary, cmd]);
  assert.equal(d(echo, idx).hide, true);
  // somebody answered it → it was a real message
  const child = { type: "assistant", uuid: "c", parentUuid: "e", message: { content: "ok" } };
  assert.equal(d(echo, T.buildIndex([echo, child, boundary, cmd])), null);
  // no compaction follows
  assert.equal(d(echo, T.buildIndex([echo])), null);
  // automatic compaction is not caused by typing
  const auto = { ...boundary, compactMetadata: { trigger: "auto" } };
  assert.equal(d(echo, T.buildIndex([echo, auto, cmd])), null);
  // " /exit" style typos are not echoes
  assert.equal(d(user("/compactify"), idx), null);
});

test("compact summary is collapsible meta", () => {
  const s = d(user("This session is being continued from a previous conversation…", { isCompactSummary: true }));
  assert.equal(s.kind, "meta");
  assert.match(s.tag, /compact summary/);
});

test("skill injection gets the skill name from its base directory", () => {
  const s = d(
    user([{ type: "text", text: "Base directory for this skill: /x/skills/test-driven-development\n\n# TDD\n..." }], {
      isMeta: true,
      sourceToolUseID: "toolu_1",
    }),
  );
  assert.match(s.tag, /skill/);
  assert.equal(s.summary, "test-driven-development");
});

test("continue marker: compact line when meta, a human message otherwise", () => {
  assert.match(d(user("Continue from where you left off.", { isMeta: true })).tag, /continue/);
  assert.equal(d(user("Continue from where you left off.")), null);
});

test("other meta records keep the existing inject rendering; isMeta must be literally true", () => {
  assert.equal(d(user("Caveat: …", { isMeta: true })).legacy, "meta");
  assert.equal(d(user("some text", { isMeta: "no" })), null);
});

test("subagent report: visible card, report text without the harness frame, task description", () => {
  const text =
    'Another Claude session sent a message:\n<agent-message from="a1">\n[Subagent hand-back] The text below is the final report. The report follows:\n  ## Итог\n  \n  всё готово\n</agent-message>\n\nThat "other Claude session" is an agent…';
  const launch = {
    type: "user",
    uuid: "L",
    toolUseResult: { agentId: "a1", description: "Ревью diff фазы 1′", status: "async_launched" },
    message: { content: [{ type: "tool_result", tool_use_id: "t", content: "launched" }] },
  };
  const r = user(text, { isMeta: true, uuid: "R" });
  const s = d(r, T.buildIndex([launch, r]));
  assert.equal(s.kind, "assistant report");
  assert.equal(s.body, "## Итог\n\nвсё готово");
  assert.match(s.summary, /Ревью diff фазы 1′/);
});

test("subagent report: a leading harness note is not part of the report", () => {
  const text =
    'Another Claude session sent a message:\n<agent-message from="a1">\nframe. The report follows:\n  [harness: subagent output matched instruction-shaped pattern(s): x. Control tags below are neutralized.]\n  \n  Отчёт записан.\n</agent-message>';
  const s = d(user(text, { isMeta: true }));
  assert.equal(s.body, "Отчёт записан.");
});

const askUse = {
  type: "assistant",
  uuid: "q",
  message: {
    id: "m",
    content: [
      {
        type: "tool_use",
        id: "toolu_ask",
        name: "AskUserQuestion",
        input: { questions: [{ question: "Как показывать большой блок?", options: [{ label: "Панель" }] }] },
      },
    ],
  },
};
const askResult = {
  type: "user",
  uuid: "a",
  toolUseResult: { answers: { "Как показывать большой блок?": "Панель" }, annotations: {} },
  message: { content: [{ type: "tool_result", tool_use_id: "toolu_ask", content: 'Your questions have been answered: "…"="Панель"' }] },
};

test("AskUserQuestion renders one question → answer card and swallows its result", () => {
  const idx = T.buildIndex([askUse, askResult]);
  const s = T.describeTool(askUse.message.content[0], idx);
  assert.equal(s.kind, "assistant ask");
  assert.match(s.body, /Как показывать большой блок\?/);
  assert.match(s.body, /Панель/);
  assert.ok(idx.askCards.has("toolu_ask"));
});

test("AskUserQuestion without an answer still renders, marked as unanswered", () => {
  const idx = T.buildIndex([askUse]);
  const s = T.describeTool(askUse.message.content[0], idx);
  assert.match(s.body, /—/);
});

test("user count agrees with the feed: the /compact quartet and wrappers are not messages", () => {
  const echo = user("/compact не сохраняй ничего", { uuid: "e" });
  const rows = [
    user("Привет.", { uuid: "h1" }),
    echo,
    { type: "system", subtype: "compact_boundary", uuid: "b", compactMetadata: { trigger: "manual" } },
    user("This session is being continued…", { uuid: "cs", isCompactSummary: true }),
    user("<command-name>/compact</command-name>", { uuid: "cn" }),
    user("<local-command-stdout>Compacted</local-command-stdout>", { uuid: "ls" }),
    user("<task-notification>x</task-notification>", { uuid: "tn" }),
    user([{ type: "text", text: "[Request interrupted by user]" }], { uuid: "in" }),
    user("Начинай фазу 1", { uuid: "h2" }),
    user("some text", { uuid: "h3", isMeta: "no" }),
    askUse,
    askResult,
  ];
  assert.equal(T.computeStats(rows).nUser, 3);
});

// --- challenger review of 93fe3da: mutants that survived and live-data mismatches ---

const plan = (r, rows = [r]) => T.planUserRecord(r, T.buildIndex(rows));
const humanTexts = (items) => items.filter((x) => x.type === "text" && x.spec === null).map((x) => x.text);

test("a reply typed while a tool ran (text block next to tool_result) is a message and is counted", () => {
  const r = {
    type: "user",
    uuid: "u",
    toolUseResult: { stdout: "" },
    message: {
      content: [
        { type: "tool_result", tool_use_id: "t", content: "ok" },
        { type: "text", text: "но local json пока не трогай" },
      ],
    },
  };
  assert.deepEqual(humanTexts(plan(r)), ["но local json пока не трогай"]);
  assert.equal(T.computeStats([r]).nUser, 1);
});

test("system-reminder block followed by a live block: the live block is the message", () => {
  const r = user([
    { type: "text", text: "<system-reminder>\nnote\n</system-reminder>" },
    { type: "text", text: "посмотри это" },
  ]);
  assert.deepEqual(humanTexts(plan(r)), ["посмотри это"]);
  assert.equal(T.computeStats([r]).nUser, 1);
});

test("live text after a wrapper tag is a human message, never swallowed", () => {
  for (const t of [
    "<bash-stdout>x</bash-stdout> что это значит?",
    "<system-reminder>a</system-reminder> посмотри",
    "<local-command-stdout>Bye!</local-command-stdout> почему?",
    "<command-name>/x</command-name> а теперь вопрос",
    "<fork-boilerplate>boilerplate</fork-boilerplate>\nYour directive: сделай задачу 3",
  ])
    assert.equal(d(user(t)), null, t);
  // machine tails stay machine
  assert.equal(d(user("<task-notification>x</task-notification>\nFull transcript available at: /tmp/x")).legacy, "task");
  assert.equal(
    d(user("<command-message>superpowers:x</command-message>\n<command-name>/superpowers:x</command-name>\n<skill-format>true</skill-format>")).kind,
    "system",
  );
  assert.equal(d(user("<fork-boilerplate>only boilerplate</fork-boilerplate>")).legacy, "meta");
});

test("a non-meta text that merely starts like a subagent report stays a human message", () => {
  assert.equal(d(user('Another Claude session sent a message:\n<agent-message from="x">hi</agent-message>')), null);
});

test("structured answers are shown in full, even past the raw text's clip point", () => {
  const qs = ["Первый вопрос?", "Второй вопрос?", "Третий вопрос?"];
  const long = "очень длинный ответ ".repeat(30) + "КОНЕЦ-ОТВЕТА";
  const use = {
    type: "assistant",
    uuid: "q",
    message: { content: [{ type: "tool_use", id: "k", name: "AskUserQuestion", input: { questions: qs.map((q) => ({ question: q })) } }] },
  };
  const res = {
    type: "user",
    uuid: "a",
    toolUseResult: { answers: { [qs[0]]: "A", [qs[1]]: "B", [qs[2]]: long }, annotations: { [qs[1]]: { notes: "моя заметка" } } },
    message: { content: [{ type: "tool_result", tool_use_id: "k", content: "x".repeat(400) }] },
  };
  const body = T.describeTool(use.message.content[0], T.buildIndex([use, res])).body;
  assert.match(body, /КОНЕЦ-ОТВЕТА/);
  assert.match(body, /моя заметка/);
});

test("a declined / clarify answer without structured answers keeps the human's full text, once", () => {
  const use = {
    type: "assistant",
    uuid: "q",
    message: {
      content: [
        { type: "tool_use", id: "k", name: "AskUserQuestion", input: { questions: [{ question: "Q1?" }, { question: "Q2?" }] } },
      ],
    },
  };
  const text = "The user doesn't want to proceed with this tool use. " + "служебно ".repeat(40) + "ОТВЕТ-ЧЕЛОВЕКА";
  const res = { type: "user", uuid: "a", message: { content: [{ type: "tool_result", tool_use_id: "k", is_error: true, content: text }] } };
  const body = T.describeTool(use.message.content[0], T.buildIndex([use, res])).body;
  assert.equal(body.split("ОТВЕТ-ЧЕЛОВЕКА").length - 1, 1);
  assert.match(body, /⛔/);
});

test("AskUserQuestion with invalid input keeps its (error) result visible", () => {
  const use = {
    type: "assistant",
    uuid: "q",
    message: { content: [{ type: "tool_use", id: "k", name: "AskUserQuestion", input: { questions: "not an array" } }] },
  };
  const res = { type: "user", uuid: "a", message: { content: [{ type: "tool_result", tool_use_id: "k", is_error: true, content: "InputValidationError" }] } };
  const items = T.planUserRecord(res, T.buildIndex([use, res]));
  assert.equal(items.filter((x) => x.type === "result").length, 1);
});

test("the answered AskUserQuestion result is folded into the card", () => {
  const items = T.planUserRecord(askResult, T.buildIndex([askUse, askResult]));
  assert.equal(items.length, 0);
});

const compactCase = (gap, { withCommand = true, uuidless = 0 } = {}) => {
  const echo = user("/compact Сохранить: план", { uuid: "e" });
  const filler = Array.from({ length: gap }, (_, i) => ({ type: "attachment", uuid: `f${i}`, attachment: { type: "date" } }));
  const noUuid = Array.from({ length: uuidless }, () => ({ type: "permission-mode", permissionMode: "auto" }));
  const tail = [
    { type: "system", subtype: "compact_boundary", uuid: "b", compactMetadata: { trigger: "manual" } },
    ...(withCommand ? [user("<command-name>/compact</command-name>\n<command-args>Сохранить: план</command-args>", { uuid: "c" })] : []),
  ];
  const rows = [echo, ...noUuid, ...filler, ...tail];
  return d(echo, T.buildIndex(rows));
};

test("compact echo: records without uuid don't count towards the look-ahead window", () => {
  assert.equal(compactCase(0, { uuidless: 18 })?.hide, true);
});

test("compact echo: boundary and command inside 15 uuid records hide it, further away they don't", () => {
  assert.equal(compactCase(13)?.hide, true);
  assert.equal(compactCase(20), null);
});

test("compact echo is hidden only when the command record that carries its args follows", () => {
  assert.equal(compactCase(0, { withCommand: false }), null);
});

test("compact echo: the command record as the 16th uuid record is out of the window", () => {
  assert.equal(compactCase(14), null);
});

test("an empty or blank user record is not a message", () => {
  assert.equal(T.computeStats([user("   ")]).nUser, 0);
  assert.equal(T.computeStats([user([{ type: "text", text: "" }])]).nUser, 0);
});

test("a hidden compact echo leaves nothing in the record's plan", () => {
  const echo = user("/compact x", { uuid: "e" });
  const rows = [
    echo,
    { type: "system", subtype: "compact_boundary", uuid: "b", compactMetadata: { trigger: "manual" } },
    user("<command-name>/compact</command-name>", { uuid: "c" }),
  ];
  assert.deepEqual(T.planUserRecord(echo, T.buildIndex(rows)), []);
  // …and "/compactify" in the same position is a message
  const typo = user("/compactify", { uuid: "e" });
  assert.equal(humanTexts(T.planUserRecord(typo, T.buildIndex([typo, ...rows.slice(1)]))).length, 1);
});

test("skill name survives a trailing slash in the base directory", () => {
  const s = d(user("Base directory for this skill: /x/skills/brainstorming/\n\n# B", { isMeta: true, sourceToolUseID: "t" }));
  assert.equal(s.summary, "brainstorming");
});

test("interruption marker padded with whitespace is still a marker", () => {
  assert.match(d(user("\n[Request interrupted by user]\n")).tag, /interrupted/);
});

test("a wrapper tag in the middle of a human message does not make it machine text", () => {
  assert.equal(d(user("посмотри, что пишет <task-notification> в логе")), null);
});

test("subagent report without indentation keeps its whole inner text", () => {
  const s = d(user('Another Claude session sent a message:\n<agent-message from="z">\nплоский отчёт\n</agent-message>', { isMeta: true }));
  assert.equal(s.body, "плоский отчёт");
});

test("an unclosed <task-notification> typed by a human is a message (real ones are always closed)", () => {
  assert.equal(d(user("<task-notification> вставил кусок лога, разберись")), null);
});
