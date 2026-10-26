# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

Nothing yet.

## [0.1.3] — 2026-10-26

**Search arrives.** Find words or a phrase in the open session and step through the hits; tool calls can fold into one line per run; Edit/Write results read as diffs. Also a round of robustness fixes found by auditing the viewer against the mistakes of similar tools — one odd field or block no longer breaks the file, nothing the viewer hides goes uncounted.

### Added

- **Search in the session** — `/`, words or `"a phrase"`, Enter / Shift+Enter (outside the box also `n` / `N`), Esc clears, "only mine"; a hit beyond the loaded chunks is drawn on the way.
- **Diffs** — the result of an `Edit` / `Write` is shown as a colored diff, from the patch Claude Code stores with it (`+N −M` in the header).
- **Task cards** — `TaskCreate` / `TaskUpdate` read as `#7 → completed · subject`, the subject taken from the latest creation of a task with that number.
- **Resume command** — `📋 claude --resume` next to the stats line copies `cd '<project dir>' && claude --resume <session id>`; hidden for subagent transcripts and for paths or ids a shell could misread.
- **Token totals** in the stats line — each API message counted once.
- `already_read_file` attachments (a file read again, unchanged) get a one-line summary instead of `? new record type`.
- **Model fallback** inside a reply (`claude-fable-5 → claude-opus-4-8`) is shown as a system line (System / meta filter); before, it was dropped.
- A tool reference in a result (after `ToolSearch`) reads `🔎 tool loaded: WebFetch` instead of raw JSON.
- The stats line counts broken lines, and `? N new record types` also lists content blocks this version doesn't know (`content:<type>`).
- **Tool runs** — with the Tools filter off, each run of tool calls between messages is one line: count and the tools used.
- **`hidden N`** in the stats line — records hidden on purpose (repeats of a value, delivered queue items, empty reminders) are counted, with the kinds on hover.
- README: "How it differs", and how to read transcripts when Claude Code runs on a server (mounted drive or copy).

### Fixed

- Switching the UI language no longer throws away the records loaded with "Load more", the opened blocks and the scroll position.
- A file that finishes reading after a newer one was opened no longer replaces it; the older read is stopped.
- One field the browser can't turn into text (`{"toString": 1}` is valid JSON) no longer stops the whole file with "Read error".
- A broken block in a Claude reply no longer turns the whole reply into an error card; blocks of an unknown type, and user content of an unexpected shape, are shown as JSON (UI state filter) instead of vanishing.
- Cutting a long text no longer splits an emoji in half.
- "Save file" keeps non-Latin letters in the file name (it used to turn `сессия.jsonl` into `_.txt`).
- Notices such as "Reading…" follow a language switch.
- A language switch with many chunks loaded no longer freezes the page for the whole file: the chunks up to the entry on screen are drawn at once, the rest in the background (200 MB, everything loaded: 5.8 s → 1.7 s with the reader at the first quarter).
- Text the CLI marks as typed by a human (`promptSource`) is the human's message even when it looks like a CLI marker, e.g. a pasted `[Request interrupted by user]`.
- Links in a transcript no longer let the browser resolve their host names in advance (DNS prefetch is off).

### Changed

- README, known limits: the measured size instead of "~100 MB" — 200 MB opens in ~3 s; reading it to the end costs ~40 s and ~1 GB.

## [0.1.2] — 2026-10-26

### Added

- The version is shown in the header and links to the releases. A release tag that differs from it fails the build.

### Changed

- Russian UI and README: one word for a transcript, «стенограмма».

## [0.1.1] — 2026-10-25

**Upgrade if you run Claude Code newer than 2.1.7x.** This release catches up with the transcript format up to 2.1.310 (v0.1.0 was written against 2.1.7x): command wrappers, skill injections and subagent reports no longer show up as your messages, `--resume` duplicates no longer inflate the stats, and one malformed record no longer stops the feed.

### Added

- **Rule tables for record types** — system subtypes, attachments and state records each get a short summary. A type the viewer doesn't know is still shown (the text the CLI rendered for it, else the raw JSON) and counted in the stats line as `? N new record types`, with the list on hover.
- **Hooks filter** (off by default) — hook runs, errors, blocking errors and stop-hook summaries.
- **⤢ Open in full** — entries cut for display open whole in a panel over the feed: plain text / markdown / raw JSON of the record, "Copy all", "Save file".
- **Question → answer card** — an `AskUserQuestion` call and the human's answer in one card, kept in reader mode.
- **Subagent reports** — `SubagentHandback` and reports delivered to the main session (`↩ report`, with the task name); finish notifications of background subagents show tokens · time · tool calls; synchronous `Agent` results show the same from `toolUseResult`.
- **Compaction** — a divider with the token drop; the summary is collapsed; the `/compact` echo is hidden. Reader mode keeps every divider and the `/compact` command with its arguments.
- **Images** — base64 images (png / jpeg / gif / webp) are drawn when their block is opened, including PDF pages read by `Read` and images attached with `@path`. Nothing is fetched; `📋` never carries base64 (the raw record in the panel's JSON mode does).
- **Your words in a declined tool call** ("…the user said: …") are shown as your message; an `AskUserQuestion` that timed out says so, and the selection is marked as an unsent draft.
- **`<persisted-output>`** — results too large for the transcript show the size and the file they were saved to.
- CI: syntax check of the inline script and unit tests on every push to `main`, every pull request and before a release build (Node 22). Release notes are taken from this file.
- Labels for 18 more tools (34 in all); sensitive records (system prompt, `CLAUDE.md` text, session context, environment) show only counts in their one-line summary; markdown in the panel is switched off above 30 000 characters.

### Changed

- **User records are classified** — command wrappers, local command output, `!` shell input and output, interruption markers, skill injections and system reminders are no longer shown as your messages; live text after a wrapper still is.
- **Who wrote it** — subagent reports, messages from other sessions (`<cross-session-message>`) and the task a parent model gives a subagent or a fork are no longer signed as yours; the CLI's own origin marks are used when present.
- **Stats line** — your messages are counted by the same rules as the feed; model replies are counted per API message (one reply written as several lines counts once); the share of service records is shown; duplicates after `--resume` / fork are merged (first position, latest content) and their number shown; API request logs (CLI 2.1.300+, up to half the file) are skipped before parsing, with count and size; a file of nothing but API logs says so.
- **State records** (session title, agent name, permission mode), which the CLI rewrites every turn, are shown only when the value changes.
- **Message queue** — a message typed while Claude works appears once, where it reached the conversation. Text that exists only in the queue (older CLIs) is shown as your message; text pulled back to the input box is marked as not sent.
- `demo.jsonl` extended with records of the new format.

### Fixed

- One malformed record no longer stops rendering (in v0.1.0 it took down the rest of its chunk of 500 records and the "Load more" button).
- `&` in markdown links and code was escaped twice (`&amp;`).
- Field values like `constructor` or `__proto__` no longer leak function text into labels.
- Pathological input (a wall of unclosed tags, megabyte strings where an object is expected) no longer freezes the page.
- Switching the language no longer brings back the previously opened file after an error, an empty file or a dropped folder.
- An invalid timestamp is left empty instead of "Invalid Date".

## [0.1.0] — 2026-04-22

First public release.

### Added

- Single-file HTML viewer for Claude Code JSONL transcripts.
- Six UI languages with live switcher: English, Русский, Español, Français, 中文, العربية. Arabic auto-switches to RTL.
- Light / dark theme with automatic detection from the OS `prefers-color-scheme`. Manual click pins the choice.
- Drag-and-drop file loading — drop anywhere on the page. Folders and non-file drags are rejected cleanly.
- Reader mode — one toggle that hides all service entries, leaving only real user messages and assistant text.
- Copy-per-message button in every entry header. Clipboard API with `document.execCommand` fallback for `file://` contexts. ✓ confirmation for 1.2 s after copy.
- Friendly tool names — 16 known Claude Code tools get emoji + label (`📖 Read file`, `🖥️ Shell`, `📝 Edit file`, …). Unknown / MCP tools keep `🔧 {raw_name}`.
- Bundled `demo.jsonl` + "Try with example" button in the empty state (online only — `fetch()` is blocked on `file://`).
- Five category filters: thinking, tools, results, system/meta, ui-state. Toggle via a single CSS class, no DOM reflow.
- Streaming JSONL parse via `file.stream()` + `TextDecoderStream` — no full-string load.
- Native virtualization via `content-visibility: auto` on each entry.
- Chunked rendering — 500 records per chunk, "Load more" button for the rest.
- Size caps — 20 KB prose / 5 KB service blocks. Stringification is also bounded.
- `.json` fallback — plain JSON arrays/objects are parsed as records too.

### Security / privacy

- XSS-safe markdown rendering: every text block is HTML-escaped before `marked.parse` so raw HTML can never reach the DOM.
- Markdown images are neutralized — rendered as inert text with visible URL, never fetched. Prevents a crafted transcript from leaking the viewer's IP / usage via tracker images.
- External links restricted to `http(s)` and opened with `rel="noopener noreferrer nofollow" target="_blank"`. Other schemes (`javascript:`, `data:`, `file:`, `mailto:`) are rendered as plain text.
- `localStorage` access wrapped in try/catch — survives strict privacy modes.

### Packaging

- Unlicense (public domain, no attribution required).
- GitHub Pages hosted live demo.
- Single-file release build via CI — one HTML with marked.min.js inlined, available as a release asset.

[Unreleased]: https://github.com/hitmman55/claude-code-chat-viewer/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/hitmman55/claude-code-chat-viewer/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/hitmman55/claude-code-chat-viewer/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/hitmman55/claude-code-chat-viewer/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/hitmman55/claude-code-chat-viewer/releases/tag/v0.1.0
