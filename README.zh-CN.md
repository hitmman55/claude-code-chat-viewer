<p align="center">
  <a href="https://hitmman55.github.io/claude-code-chat-viewer/">
    <img src="https://img.shields.io/badge/▶-在线试用-2ea043?style=for-the-badge" alt="在线试用" />
  </a>
</p>
<p align="center"><i>点击即用 — 无需安装、构建或注册。</i></p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <b>中文</b> ·
  <a href="README.ar.md">العربية</a>
</p>

# Claude Code Chat Viewer

在浏览器中阅读你的 Claude Code 对话历史。Claude Code 把每次会话保存为 `~/.claude/projects/` 下的一个 JSONL 文件；在这里打开它，它就会变成可读的消息流——你的消息、Claude 的回复、思考过程（thinking）、工具调用及其结果、子代理报告——并带有过滤器和阅读模式。只有一个 HTML 文件，无需服务器，无需安装，离线可用；任何数据都不会离开你的电脑。支持 Claude Code 2.1.310 及更早版本的会话记录格式。

<p align="center">
  <img src="https://img.shields.io/badge/license-Unlicense-blue" alt="许可证：Unlicense" />
  <img src="https://img.shields.io/badge/runtime%20deps-0-brightgreen" alt="零运行时依赖" />
  <img src="https://img.shields.io/badge/offline-first-success" alt="离线可用" />
  <img src="https://img.shields.io/badge/i18n-6%20languages-informational" alt="6 种界面语言" />
</p>

<p align="center">
  <img src="screenshot.png" alt="截图" width="900" />
</p>

## 为什么

Claude Code 把每次会话写入 `~/.claude/projects/<project>/<session-uuid>.jsonl` — 每行一条记录（用户消息、模型回复、thinking、tool_use、tool_result、attachment 等）。原始文件几乎无法阅读；内置命令如 `/resume` 和 `/export` 能重新打开或原样导出对话，但无法查看带有工具调用和服务记录的旧会话记录。

这个查看器把这样的 `.jsonl` 变成可读的时间流，按角色着色，服务块（thinking / tools / results）可折叠，附带过滤器。

## 显示的内容

- **user**(蓝色)— 真实的用户消息
- **assistant**(绿色)— Claude 的文字回复
- **thinking**(紫色)— extended thinking，默认折叠
- **tool_use**(琥珀色)— 工具调用，附带参数预览
- **tool_result**(青色 / 错误为红色)— 工具响应
- **meta / task-note**(黄色)— 系统注入和子代理的 `<task-notification>`
- **问题 → 回答** — `AskUserQuestion` 调用与用户的回答合并为一张卡片
- **子代理报告**（`↩ report`）— 子代理的最终报告，并标注其任务名称；后台子代理结束时显示 token 数 · 用时 · 工具调用次数
- **hooks** — hook 的运行与错误（独立过滤器，默认关闭）
- **压缩（compaction）** — 一条分隔线，显示压缩前后的 token 数；压缩摘要默认折叠
- **图片** — 记录中保存的截图和 PDF 页面，展开所在的块时才显示
- **system / attachment / ui-state** — 服务记录（默认隐藏）；CLI 每轮都会重写的值（会话标题、权限模式）只在发生变化时显示

每个块都是独立的一行，左侧有彩色条。没有聊天气泡：这是一份日志，不是聊天界面。

## 如何打开

按喜好选择：

**A. 下载单文件** — 最简单。从[最新 release](https://github.com/hitmman55/claude-code-chat-viewer/releases/latest) 下载独立 HTML，双击即可。一个文件，永久离线可用。

**B. 克隆仓库** — 想改代码就选这个。需要 `index.html` 和 `lib/` 目录。

**C. 在线使用** — 直接打开 <https://hitmman55.github.io/claude-code-chat-viewer/>。无需下载。

打开后，点击文件选择器（或拖放文件，或点击「试用示例」按钮），选择一个 `.jsonl` 记录。

Claude Code 的记录位于：

```
~/.claude/projects/<project-slug>/<session-uuid>.jsonl
```

其中 `<project-slug>` 是把你的工作目录中除字母和数字以外的所有字符都替换为 `-` 得到的名称。例如：`/home/user/my_proj` → `-home-user-my-proj`。

## 功能

### 如何加载文件

- **文件选择器** — 点击「选择文件」并选取一个 `.jsonl`。
- **拖放** — 把文件拖到页面任意位置。虚线边框标示拖放区域。文件夹和非文件的拖放会被温和拒绝。
- **试用示例** — 初始状态（在线访问时）显示一个按钮，加载内置的 `demo.jsonl` 展示主要的条目类型。

### 阅读体验

- **阅读模式** — 标题栏开关，只保留人和 Claude 说的话：你的消息（包括 `/compact` 及其参数）、Claude 的文本回复、问题 → 回答卡片、子代理报告和压缩分隔线。无 thinking，无工具调用，无服务记录。适合快速浏览，或分享一个干净的视图。
- **逐条消息复制** — 每条条目标题栏的 `📋` 按钮。把文本复制到剪贴板，显示 1.2 秒 `✓` 确认。使用 `navigator.clipboard.writeText`，对 `file://` 上下文回退到 `document.execCommand`。
- **如实的统计行** — 用户消息和模型回复按与消息流相同的规则计数（工具输出、命令包装和通知不算作你的消息）；`--resume` 之后的重复记录会合并；API 请求日志会被跳过（CLI 2.1.300+）。`? N 种新记录类型` 标出本版本尚不认识的记录类型：悬停可查看列表，这些记录仍以 JSON 形式显示。
- **友好的工具名称** — 已知工具配有图标（例如 `📖 Read file`、`🖥️ Shell`、`📝 Edit file`）。未知 / MCP 工具 → `🔧 {raw_name}`。
- **自动主题** — 查看器默认跟随系统的 `prefers-color-scheme`。点击太阳/月亮按钮固定选择；固定后跨会话保存。
- **六种界面语言** — English、Русский、Español、Français、中文、العربية。阿拉伯语自动切换为 RTL。标题栏中的下拉选择器，偏好会保存。

### 性能与安全

- **流式解析** — `.jsonl` 通过 `file.stream()` + `TextDecoderStream` 读取，不会整体加载为单个字符串。
- **原生虚拟化** — 每条记录使用 `content-visibility: auto`：浏览器跳过屏幕外条目的布局和绘制。可扩展到成千上万条记录。
- **分块渲染** — 每块 500 条，剩余部分通过「加载更多」按钮加载。
- **过滤器** — 六个复选框（thinking / tools / results / system / hooks / ui-state），通过容器上的单个 CSS 类切换类别（无需重新渲染）。
- **XSS 安全渲染** — 每个文本块在传入 markdown 解析器*之前*会先进行 HTML 转义。会话记录中的原始 HTML 永远不会进入 DOM，因此运行时不需要 DOM 净化器（sanitizer）。Markdown 图片被中和（显示为惰性文本，永不加载）。链接限制为 `http(s)` 并使用 `rel="noopener noreferrer nofollow"`。
- **大小限制** — prose 块截断至 20000 个字符，服务块截断至 5000 个字符。`📋` 按钮复制的是显示出来的内容，不超出这些限制，因此点一下绝不会复制兆字节级的文本；全文只在需要时通过 `⤢` 获取。
- **⤢ 查看全文** — 显示时被截断的条目带有 `⤢` 按钮：全文在消息流上方的面板中打开（纯文本 / markdown / 记录的原始 JSON），可「全部复制」和「保存文件」。消息流本身的高度不会改变。
- **`.json` 回退** — 如果文件不是 JSONL 而是普通的 JSON 数组/对象，会作为记录列表解析。

## 浏览器要求

- Chrome / Edge 85+
- Firefox 105+
- Safari 15.4+

`content-visibility: auto`（Firefox 125+、Safari 18+）只是让大文件滚动得更快；没有它一切照常工作，只是慢一些。

## 依赖

只有一个，在本地 `lib/` 中打包：

- [marked](https://github.com/markedjs/marked) — markdown → HTML(~35 KB)

没有 CDN，没有网络，没有 Subresource Integrity。克隆即可运行。

## 会话记录中的个人信息

一份会话记录包含的远不止对话本身。在分享 `.jsonl` 文件（或查看器截图）之前，请了解其中包含：

- 所有消息、thinking 块和工具输出，包括文件内容和命令输出——其中可能有密钥、token 或密码；
- 绝对路径、你的用户名、工作目录和 git 分支，每条记录都会重复出现；
- 账户邮箱、完整的系统提示词以及你的 `CLAUDE.md` 文件内容——这些记录默认隐藏（system / ui-state 过滤器），其一行摘要只显示计数，展开某条记录才会显示其内容；
- 图片：会话中读取的截图和 PDF 页面；
- 完整的 API 请求日志（`api-request*` 行，CLI 2.1.300+；最多可占文件的一半）——查看器会跳过它们，但它们仍在文件中。

过大的输出不在会话记录中：Claude Code 把它们保存在文件旁边的 `<session>/tool-results/` 中，查看器只显示约 2 KB 的预览和路径。

## 隐私

一切都在你的浏览器本地运行。查看器本身**不发起任何自动网络请求** — 没有 CDN，没有分析，没有远程字体。会话记录中嵌入的 Markdown 图片会被中和：以惰性文本形式显示（URL 可见但不会被获取）。外部链接（仅限 `http(s)`）只在你点击时才会在新标签页打开，并带有 `rel="noopener noreferrer nofollow"`。你的会话记录留在你的机器上。会话记录中以 base64 保存的图片直接从文件本身绘制，同样不会发出任何网络请求。

## 已知限制

- 超过约 100 MB 的文件需要基于 line-offset 的索引化加载与窗口化渲染（尚未实现）。
- 不能导出整个会话（目标是浏览，不是转换）；单个条目可以通过 `⤢` →「保存文件」保存。
- 代码块中没有语法高亮（有意为之 — 保持依赖最小）。
- 编辑后重新发送的消息会出现两次——对话分支尚未以树形显示。
- 服务记录的标签显示原始记录类型名（例如 `hook_success`），不做翻译——这样新类型无需翻译。

## 开发

所有代码都在一个 HTML 文件里。直接编辑即可 — 样式在 `<style>`，逻辑在 `<script>`，翻译在脚本开头的 `I18N` 对象中。

不用浏览器就能检查语法、运行测试（无需安装任何东西）：

```bash
node scripts/check-syntax.mjs  # syntax of the inline script
node --test test/*.test.mjs    # unit tests
```

不依赖 DOM 的部分——记录分类和决定每种记录如何显示的规则表——位于脚本的 `triage` 和 `rules` 两个部分，各自在 `// ===== <name> =====` 与 `// ===== end <name> =====` 之间；测试会把它们从 `index.html` 中截取出来，在 Node 中运行。支持一种新的记录类型通常只需在规则表中加一项。

## 许可证

[Unlicense](LICENSE) — 公有领域。随意使用，无需署名。
