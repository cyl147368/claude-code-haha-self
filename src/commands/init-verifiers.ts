import type { Command } from '../commands.js'

const command = {
  type: 'prompt',
  name: 'init-verifiers',
  description: '为代码变更自动验证创建 verifier skill',
  contentLength: 0, // Dynamic content
  progressMessage: '正在分析项目并创建 verifier skills',
  source: 'builtin',
  async getPromptForCommand() {
    return [
      {
        type: 'text',
        text: `使用 TodoWrite 工具跟踪这个多步骤任务的进度。

## 目标

创建一个或多个 verifier skills，供 Verify agent 自动验证此项目或文件夹中的代码变更。如果项目有不同验证需求（例如同时有 Web UI 和 API endpoint），可以创建多个 verifier。

**不要为单元测试或类型检查创建 verifier。** 标准 build/test 工作流已经处理这些内容，不需要专门的 verifier skill。重点关注功能验证：Web UI（Playwright）、CLI（Tmux）和 API（HTTP）verifier。

## 阶段 1：自动检测

分析项目，检测不同子目录中有什么。该项目可能包含多个子项目或需要不同验证方法的区域，例如一个 repo 中同时有 Web 前端、API 后端和共享库。

1. **扫描顶层目录**，识别不同项目区域：
   - 查找子目录中的独立 package.json、Cargo.toml、pyproject.toml、go.mod
   - 识别不同文件夹中的应用类型

2. **对每个区域检测：**

   a. **项目类型和技术栈**
      - 主要语言和框架
      - 包管理器（npm、yarn、pnpm、pip、cargo 等）

   b. **应用类型**
      - Web app（React、Next.js、Vue 等）-> 建议 Playwright-based verifier
      - CLI tool -> 建议 Tmux-based verifier
      - API service（Express、FastAPI 等）-> 建议 HTTP-based verifier

   c. **现有验证工具**
      - 测试框架（Jest、Vitest、pytest 等）
      - E2E 工具（Playwright、Cypress 等）
      - package.json 中的 dev server scripts

   d. **Dev server 配置**
      - 如何启动 dev server
      - 它运行在哪个 URL
      - 哪段文本表示它已 ready

3. **已安装的验证包**（用于 Web app）
   - 检查是否安装 Playwright（查看 package.json 的 dependencies/devDependencies）
   - 检查 MCP 配置（.mcp.json）中是否有浏览器自动化工具：
     - Playwright MCP server
     - Chrome DevTools MCP server
     - Claude Chrome Extension MCP（通过 Claude Chrome extension 的 browser-use）
   - 对 Python 项目，检查 playwright、pytest-playwright

## 阶段 2：验证工具设置

基于阶段 1 的检测结果，帮助用户设置合适的验证工具。

### 对 Web 应用

1. **如果已安装或配置浏览器自动化工具**，询问用户想使用哪一个：
   - 使用 AskUserQuestion 展示检测到的选项
   - 示例："我发现已配置 Playwright 和 Chrome DevTools MCP。你想用哪个做验证？"

2. **如果没有检测到浏览器自动化工具**，询问是否要安装或配置一个：
   - 使用 AskUserQuestion："未检测到浏览器自动化工具。要为 UI 验证设置一个吗？"
   - 提供选项：
     - **Playwright**（Recommended）- 完整浏览器自动化库，可 headless 运行，适合 CI
     - **Chrome DevTools MCP** - 通过 MCP 使用 Chrome DevTools Protocol
     - **Claude Chrome Extension** - 通过 Claude Chrome extension 进行浏览器交互（需要在 Chrome 中安装扩展）
     - **None** - 跳过浏览器自动化（只使用基础 HTTP 检查）

3. **如果用户选择安装 Playwright**，根据包管理器运行合适命令：
   - npm：\`npm install -D @playwright/test && npx playwright install\`
   - yarn：\`yarn add -D @playwright/test && yarn playwright install\`
   - pnpm：\`pnpm add -D @playwright/test && pnpm exec playwright install\`
   - bun：\`bun add -D @playwright/test && bun playwright install\`

4. **如果用户选择 Chrome DevTools MCP 或 Claude Chrome Extension**：
   - 它们需要 MCP server 配置，而不是 package 安装
   - 询问是否要把 MCP server 配置添加到 .mcp.json
   - 对 Claude Chrome Extension，告知用户需要从 Chrome Web Store 安装扩展

5. **MCP Server 设置**（如果适用）：
   - 如果用户选择基于 MCP 的选项，配置 .mcp.json 中的对应 entry
   - 更新 verifier skill 的 allowed-tools，使用对应的 mcp__* 工具

### 对 CLI 工具

1. 检查 asciinema 是否可用（运行 \`which asciinema\`）
2. 如果不可用，告知用户 asciinema 可帮助记录验证会话，但它是可选的
3. Tmux 通常由系统安装，只需验证它可用

### 对 API 服务

1. 检查 HTTP 测试工具是否可用：
   - curl（通常系统已安装）
   - httpie（\`http\` 命令）
2. 通常无需安装

## 阶段 3：交互式问答

基于阶段 1 检测到的区域，可能需要创建多个 verifier。对每个独立区域，使用 AskUserQuestion 确认：

1. **Verifier 名称** - 根据检测结果建议名称，但允许用户选择：

   如果只有一个项目区域，使用简单格式：
   - Web UI 测试用 "verifier-playwright"
   - CLI/terminal 测试用 "verifier-cli"
   - HTTP API 测试用 "verifier-api"

   如果有多个项目区域，使用 \`verifier-<project>-<type>\` 格式：
   - 前端 Web UI 用 "verifier-frontend-playwright"
   - 后端 API 用 "verifier-backend-api"
   - admin dashboard 用 "verifier-admin-playwright"

   \`<project>\` 部分应是子目录或项目区域的短标识，例如文件夹名或 package name。

   允许自定义名称，但名称中必须包含 "verifier"；Verify agent 会通过查找文件夹名中的 "verifier" 来发现 skills。

2. **基于类型的项目特定问题：**

   对 Web app（playwright）：
   - Dev server command（例如 "npm run dev"）
   - Dev server URL（例如 "http://localhost:3000"）
   - Ready signal（服务器 ready 时出现的文本）

   对 CLI 工具：
   - Entry point command（例如 "node ./cli.js" 或 "./target/debug/myapp"）
   - 是否用 asciinema 录制

   对 API：
   - API server command
   - Base URL

3. **认证与登录**（用于 Web app 和 API）：

   使用 AskUserQuestion 询问："你的应用是否需要认证/登录才能访问要验证的页面或 endpoint？"
   - **不需要认证** - 应用公开可访问，无需登录
   - **需要登录** - 应用要求认证后才能验证
   - **部分页面需要认证** - 同时有公开和需要认证的路由

   如果用户选择需要登录（或部分需要），继续追问：
   - **登录方式**：用户如何登录？
     - 表单登录（登录页上的 username/password）
     - API token/key（作为 header 或 query param 传入）
     - OAuth/SSO（基于 redirect 的流程）
     - 其他（让用户描述）
   - **测试凭据**：verifier 应使用什么凭据？
     - 询问登录 URL（例如 "/login"、"http://localhost:3000/auth"）
     - 询问测试 username/email 和 password，或 API key
     - 注意：建议用户用环境变量保存 secrets（例如 \`TEST_USER\`、\`TEST_PASSWORD\`），不要硬编码
   - **登录后指示器**：如何确认登录成功？
     - URL redirect（例如重定向到 "/dashboard"）
     - 元素出现（例如 "Welcome" 文本、用户头像）
     - Cookie/token 已设置

## 阶段 4：生成 Verifier Skill

**所有 verifier skills 都创建在项目根目录的 \`.claude/skills/\` 目录中。** 这样 Claude 在项目中运行时会自动加载它们。

将 skill 文件写入 \`.claude/skills/<verifier-name>/SKILL.md\`。

### Skill 模板结构

\`\`\`markdown
---
name: <verifier-name>
description: <description based on type>
allowed-tools:
  # Tools appropriate for the verifier type
---

# <Verifier Title>

你是验证执行器。你会收到一份验证计划，并严格按原文执行。

## Project Context
<Project-specific details from detection>

## Setup Instructions
<How to start any required services>

## Authentication
<If auth is required, include step-by-step login instructions here>
<Include login URL, credential env vars, and post-login verification>
<If no auth needed, omit this section>

## Reporting

按照验证计划指定的格式，为每个步骤报告 PASS 或 FAIL。

## Cleanup

验证结束后：
1. 停止任何已启动的 dev servers
2. 关闭任何 browser sessions
3. 报告最终摘要

## Self-Update

如果验证失败是因为此 skill 的指令过期（dev server command/port/ready-signal 改了等），而不是被测功能坏了；或者用户在运行中纠正你，请使用 AskUserQuestion 确认，然后用 Edit 对这个 SKILL.md 做最小定向修复。
\`\`\`

### 按类型划分的 Allowed Tools

**verifier-playwright**:
\`\`\`yaml
allowed-tools:
  - Bash(npm:*)
  - Bash(yarn:*)
  - Bash(pnpm:*)
  - Bash(bun:*)
  - mcp__playwright__*
  - Read
  - Glob
  - Grep
\`\`\`

**verifier-cli**:
\`\`\`yaml
allowed-tools:
  - Tmux
  - Bash(asciinema:*)
  - Read
  - Glob
  - Grep
\`\`\`

**verifier-api**:
\`\`\`yaml
allowed-tools:
  - Bash(curl:*)
  - Bash(http:*)
  - Bash(npm:*)
  - Bash(yarn:*)
  - Read
  - Glob
  - Grep
\`\`\`


## 阶段 5：确认创建

写入 skill 文件后，告知用户：
1. 每个 skill 创建在哪里（始终在 \`.claude/skills/\`）
2. Verify agent 如何发现它们：文件夹名必须包含 "verifier"（大小写不敏感）才能自动发现
3. 他们可以编辑 skills 进行自定义
4. 他们可以再次运行 /init-verifiers，为其他区域添加更多 verifiers
5. 如果 verifier 检测到自身指令过期（错误 dev server command、ready signal 变化等），它会主动提出自我更新
`,
      },
    ]
  },
} satisfies Command

export default command
