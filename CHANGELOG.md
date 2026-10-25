# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

Catch-up with the transcript format of Claude Code up to 2.1.310 (the viewer was written against 2.1.7x).

### Added

- **Rule tables for record types** — system subtypes, attachments and state records each get a short summary. A type the viewer doesn't know is still shown (the text the CLI rendered for it, else the raw JSON) and counted in the stats line as `? N new record types`, with the list on hover.
- **Hooks filter** (off by default) — hook runs, errors, blocking errors and stop-hook summaries.
- **⤢ Open in full** — entries cut for display open whole in a panel over the feed: plain text / markdown / raw JSON of the record, "copy all", "save to file".
- **Question → answer card** — an `AskUserQuestion` call and the human's answer in one card, kept in reader mode.
- **Subagent reports** — `SubagentHandback` and reports delivered to the main session (`↩ report`, with the task name); finish notifications of background subagents show tokens · time · tool calls; synchronous `Agent` results show the same from `toolUseResult`.
- **Compaction** — a divider with the token drop; the summary is collapsed; the `/compact` echo is hidden.
- **Images** — base64 images (png / jpeg / gif / webp) are drawn when their block is opened, including PDF pages read by `Read` and images attached with `@path`. Nothing is fetched; Copy never carries base64.
- **Your words in a declined tool call** ("…the user said: …") are shown as your message; an `AskUserQuestion` that timed out says so, and the selection is marked as an unsent draft.
- **`<persisted-output>`** — results too large for the transcript show the size and the file they were saved to.
- CI: syntax check of the inline script and unit tests on every push and before a release.

### Changed

- **User records are classified** — command wrappers, local command output, `!` shell input and output, interruption markers, skill injections and system reminders are no longer shown as your messages; live text after a wrapper still is.
- **Who wrote it** — subagent reports, messages from other sessions (`<cross-session-message>`) and the task a parent model gives a subagent or a fork are no longer signed as yours; the CLI's own origin marks are used when present.
- **Stats line** — your messages are counted by the same rules as the feed; duplicates after `--resume` / fork are merged (first position, latest content) and their number shown; API request logs (CLI 2.1.300+, often most of the file) are skipped before parsing, with count and size.
- **State records** (session title, agent name, permission mode), which the CLI rewrites every turn, are shown only when the value changes.
- **Message queue** — a message typed while Claude works appears once, where it reached the conversation. Text that exists only in the queue (older CLIs) is shown as your message; text pulled back to the input box is marked as not sent.
- `demo.jsonl` extended with records of the new format.

### Fixed

- One malformed record no longer breaks rendering of the whole file.
- `&` in markdown links and code was escaped twice (`&amp;`).
- Field values like `constructor` or `__proto__` no longer leak function text into labels.
- Pathological input (a wall of unclosed tags, megabyte strings where an object is expected) no longer freezes the page.
- Switching the language no longer brings back the previously opened file.
- Assistant records without ids (hand-made files) are no longer merged into one reply in the count.

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

[Unreleased]: https://github.com/hitmman55/claude-code-chat-viewer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/hitmman55/claude-code-chat-viewer/releases/tag/v0.1.0
