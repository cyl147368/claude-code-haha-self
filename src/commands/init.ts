import { feature } from 'bun:bundle'
import type { Command } from '../commands.js'
import { maybeMarkProjectOnboardingComplete } from '../projectOnboardingState.js'
import { isEnvTruthy } from '../utils/envUtils.js'

const OLD_INIT_PROMPT = `请分析这个代码库，并创建一个 CLAUDE.md 文件。后续 Claude Code 实例在这个仓库中工作时会读取该文件。

需要添加的内容：
1. 常用命令，例如如何构建、lint、运行测试。包含在此代码库中开发所需的命令，例如如何运行单个测试。
2. 高层代码架构和结构，帮助后续实例更快进入状态。重点写需要阅读多个文件才能理解的整体架构。

使用说明：
- 如果已经存在 CLAUDE.md，请建议如何改进它。
- 创建初始 CLAUDE.md 时不要重复，不要包含显而易见的指令，例如 "为用户提供有帮助的错误信息"、"为所有新工具函数编写单元测试"、"不要在代码或提交中包含敏感信息（API key、token）"。
- 避免列出每个组件或容易发现的文件结构。
- 不要包含通用开发实践。
- 如果存在 Cursor 规则（.cursor/rules/ 或 .cursorrules）或 Copilot 规则（.github/copilot-instructions.md），确保包含其中重要部分。
- 如果存在 README.md，确保包含其中重要部分。
- 不要编造 "Common Development Tasks"、"Tips for Development"、"Support and Documentation" 等信息，除非你读到的文件明确包含这些内容。
- 文件开头必须使用以下文本：

\`\`\`
# CLAUDE.md

这个文件为 Claude Code（claude.ai/code）在此仓库中工作提供指导。
\`\`\``

const NEW_INIT_PROMPT = `为此 repo 设置一个最小化的 CLAUDE.md，并可选设置 skills 和 hooks。CLAUDE.md 会被加载进每个 Claude Code 会话，因此必须简洁；只包含 Claude 在没有它时容易做错的内容。

## 阶段 1：询问要设置什么

使用 AskUserQuestion 了解用户想要什么：

- "要让 /init 设置哪些 CLAUDE.md 文件？"
  选项："项目 CLAUDE.md" | "个人 CLAUDE.local.md" | "项目 + 个人都设置"
  项目描述："提交到源码控制、团队共享的指令，例如架构、编码标准、常用流程。"
  个人描述："你在此项目中的私有偏好（gitignored，不共享），例如你的角色、sandbox URL、常用测试数据、工作流习惯。"

- "还要设置 skills 和 hooks 吗？"
  选项："Skills + hooks" | "仅 skills" | "仅 hooks" | "都不要，只要 CLAUDE.md"
  skills 描述："你或 Claude 可通过 \`/skill-name\` 按需调用的能力，适合可重复工作流和参考知识。"
  hooks 描述："在工具事件上运行的确定性 shell 命令，例如每次编辑后格式化。Claude 不能跳过它们。"

## 阶段 2：探索代码库

启动一个 subagent 调查代码库，并要求它阅读关键文件来理解项目：manifest 文件（package.json、Cargo.toml、pyproject.toml、go.mod、pom.xml 等）、README、Makefile/build 配置、CI 配置、现有 CLAUDE.md、.claude/rules/、AGENTS.md、.cursor/rules 或 .cursorrules、.github/copilot-instructions.md、.windsurfrules、.clinerules、.mcp.json。

检测：
- 构建、测试和 lint 命令，尤其是非标准命令
- 语言、框架和包管理器
- 项目结构（monorepo + workspaces、多模块或单项目）
- 与语言默认不同的代码风格规则
- 不明显的坑、必需环境变量或工作流习惯
- 现有 .claude/skills/ 和 .claude/rules/ 目录
- formatter 配置（prettier、biome、ruff、black、gofmt、rustfmt，或 \`npm run format\` / \`make fmt\` 这类统一格式化脚本）
- Git worktree 使用情况：运行 \`git worktree list\` 检查此 repo 是否有多个 worktree（仅当用户想要个人 CLAUDE.local.md 时相关）

记录仅靠代码无法判断的内容，这些会成为访谈问题。

## 阶段 3：补齐缺口

使用 AskUserQuestion 收集编写高质量 CLAUDE.md 文件和 skills 仍需要的信息。只问代码无法回答的问题。

如果用户选择了项目 CLAUDE.md 或两者都选：询问代码库实践，例如不明显的命令、坑、分支/PR 约定、必需 env 设置、测试细节。跳过 README 中已有或 manifest 文件显而易见的内容。不要把任何选项标成 "recommended"；这里关心的是团队如何工作，而不是最佳实践。

如果用户选择了个人 CLAUDE.local.md 或两者都选：询问用户本人，而不是代码库。不要把任何选项标成 "recommended"；这里关心的是个人偏好，而不是最佳实践。问题示例：
  - 他们在团队中的角色是什么？例如 "backend engineer"、"data scientist"、"new hire onboarding"
  - 他们对这个代码库及其语言/框架有多熟？这样 Claude 可以校准解释深度
  - 是否有 Claude 应知道的个人 sandbox URL、测试账号、API key 路径或本地设置细节？
  - 仅当阶段 2 发现多个 git worktree 时：询问他们的 worktree 是嵌套在主 repo 内（例如 \`.claude/worktrees/<name>/\`），还是同级/外部目录（例如 \`../myrepo-feature/\`）。如果是嵌套，向上查找文件会自动找到主 repo 的 CLAUDE.local.md，不需要特殊处理。如果是同级/外部，个人内容应放在 home 目录文件中（例如 \`~/.claude/<project-name>-instructions.md\`），每个 worktree 只放一个一行的 CLAUDE.local.md stub 来导入它：\`@~/.claude/<project-name>-instructions.md\`。绝不要把这个导入写进项目 CLAUDE.md，因为那会把个人引用提交到团队共享文件里。
  - 有哪些沟通偏好？例如 "简洁"、"总是解释权衡"、"结尾不要总结"

**根据阶段 2 的发现综合一份提案**，例如：如果存在 formatter，建议 format-on-edit hook；如果存在测试，建议 \`/verify\` skill；对于来自补齐问题、属于准则而非工作流的答案，写成 CLAUDE.md note。对每一项选择合适的产物类型，并**受阶段 1 skills+hooks 选择约束**：

  - **Hook**（更严格）：在工具事件上运行的确定性 shell 命令，Claude 不能跳过。适合机械、快速、逐次编辑的步骤：格式化、lint、对已改文件运行快速测试。
  - **Skill**（按需）：你或 Claude 需要时调用 \`/skill-name\`。适合不应该每次编辑都运行的流程：深度验证、会话报告、部署。
  - **CLAUDE.md note**（更宽松）：影响 Claude 行为但不强制执行。适合沟通/思考偏好："编码前先计划"、"简洁"、"解释权衡"。

  **把阶段 1 的 skills+hooks 选择当作硬过滤器**：如果用户选择 "仅 skills"，把你会建议的 hook 降级为 skill 或 CLAUDE.md note。如果选择 "仅 hooks"，把 skills 降级为 hooks（机械上可行时）或 notes。如果选择 "都不要"，所有内容都变成 CLAUDE.md note。绝不要提出用户没有选择的产物类型。

**通过 AskUserQuestion 的 \`preview\` 字段展示提案，不要作为单独文本消息展示**。对话框会覆盖你的输出，所以前置文本会被隐藏。\`preview\` 字段会在侧边面板中渲染 markdown（类似 plan mode）；\`question\` 字段只能是纯文本。结构如下：

  - \`question\`：简短纯文本，例如 "这个提案看起来对吗？"
  - 每个选项都带一个包含完整提案 markdown 的 \`preview\`。"看起来不错，继续" 选项的 preview 展示全部内容；删除某项的选项 preview 展示删除后剩余内容。
  - **preview 保持紧凑，因为 preview box 会截断且不能滚动。** 每项一行，项之间不要空行，不要标题。示例 preview 内容：

    - **Format-on-edit hook**（自动）- 通过 PostToolUse 运行 \`ruff format <file>\`
    - **/verify skill**（按需）- \`make lint && make typecheck && make test\`
    - **CLAUDE.md note**（准则）- "完成前运行 lint/typecheck/test"

  - 选项 label 保持简短（"看起来不错"、"去掉 hook"、"去掉 skill"）。该工具会自动添加 "Other" 自由文本选项，所以不要自己添加兜底选项。

**从被接受的提案构建偏好队列**。每项格式：{type: hook|skill|note, description, target file, any Phase-2-sourced details like the actual test/format command}。阶段 4-7 会消费这个队列。

## 阶段 4：写 CLAUDE.md（如果用户选择项目或两者都选）

在项目根目录写一个最小化的 CLAUDE.md。每一行都必须通过这个测试："删除这一行会导致 Claude 犯错吗？" 如果不会，就删掉。

**消费阶段 3 偏好队列中 target 为 CLAUDE.md 的 \`note\` 项**（团队级 notes），把每项作为简洁的一行放入最相关小节。这些是用户希望 Claude 遵守但不需要强制保证的行为，例如 "实现前先提出计划"、"重构时解释权衡"。个人目标的 notes 留给阶段 5。

包含：
- Claude 猜不到的构建/测试/lint 命令（非标准脚本、flag 或序列）
- 与语言默认不同的代码风格规则，例如 "TypeScript 中优先使用 type 而不是 interface"
- 测试说明和坑，例如 "运行单个测试：pytest -k 'test_name'"
- repo 礼仪（分支命名、PR 约定、commit 风格）
- 必需 env vars 或设置步骤
- 不明显的坑或架构决策
- 现有 AI coding tool 配置中的重要部分（AGENTS.md、.cursor/rules、.cursorrules、.github/copilot-instructions.md、.windsurfrules、.clinerules）

排除：
- 逐文件结构或组件列表（Claude 可以通过阅读代码库发现）
- Claude 已知道的标准语言约定
- 通用建议（"写干净代码"、"处理错误"）
- 详细 API 文档或长引用；改用 \`@path/to/import\` 语法按需 inline 内容，例如 \`@docs/api-reference.md\`，避免撑大 CLAUDE.md
- 经常变化的信息；引用源文件 \`@path/to/import\`，让 Claude 始终读取当前版本
- 长教程或 walkthrough（移动到单独文件并用 \`@path/to/import\` 引用，或放进 skill）
- manifest 文件中显而易见的命令，例如标准 "npm test"、"cargo test"、"pytest"

要具体："TypeScript 使用 2-space indentation" 比 "正确格式化代码" 更好。

不要重复自己，不要编造 "Common Development Tasks" 或 "Tips for Development" 等小节；只包含你读过的文件明确提供的信息。

文件开头使用：

\`\`\`
# CLAUDE.md

这个文件为 Claude Code（claude.ai/code）在此仓库中工作提供指导。
\`\`\`

如果 CLAUDE.md 已存在：先阅读它，提出具体 diff，并解释每个变更为何能改进它。不要静默覆盖。

对于有多个关注点的项目，建议把指令组织到 \`.claude/rules/\` 下的独立聚焦文件中，例如 \`code-style.md\`、\`testing.md\`、\`security.md\`。这些文件会与 CLAUDE.md 一起自动加载，并可通过 \`paths\` frontmatter 作用到特定文件路径。

对于有不同子目录的项目（monorepo、多模块等）：说明可添加子目录级 CLAUDE.md 来写模块特定指令（Claude 在这些目录工作时会自动加载）。如果用户想要，主动提出创建它们。

## 阶段 5：写 CLAUDE.local.md（如果用户选择个人或两者都选）

在项目根目录写一个最小化的 CLAUDE.local.md。该文件会与 CLAUDE.md 一起自动加载。创建后，把 \`CLAUDE.local.md\` 添加到项目 .gitignore，确保它保持私有。

**消费阶段 3 偏好队列中 target 为 CLAUDE.local.md 的 \`note\` 项**（个人级 notes），把每项作为简洁一行添加。如果用户在阶段 1 只选择个人文件，这是 note 项唯一的消费者。

包含：
- 用户角色及其对代码库的熟悉程度（让 Claude 校准解释）
- 个人 sandbox URL、测试账号或本地设置细节
- 个人工作流或沟通偏好

保持简短；只包含能明显改善 Claude 对该用户回复质量的内容。

如果阶段 2 发现多个 git worktree，且用户确认使用同级/外部 worktree（不是嵌套在主 repo 内）：向上查找不会让所有 worktree 找到同一个 CLAUDE.local.md。把实际个人内容写到 \`~/.claude/<project-name>-instructions.md\`，并让 CLAUDE.local.md 成为一行 stub：\`@~/.claude/<project-name>-instructions.md\`。用户可以把这一行 stub 复制到每个同级 worktree。绝不要把此导入写进项目 CLAUDE.md。如果 worktree 嵌套在主 repo 内（例如 \`.claude/worktrees/\`），不需要特殊处理；会自动找到主 repo 的 CLAUDE.local.md。

如果 CLAUDE.local.md 已存在：阅读它，提出具体补充，不要静默覆盖。

## 阶段 6：建议并创建 skills（如果用户选择 "Skills + hooks" 或 "仅 skills"）

Skills 可以让 Claude 按需获得能力，而不膨胀每个会话上下文。

**首先，消费阶段 3 偏好队列中的 \`skill\` 项。** 每个排队的 skill 偏好都变成一个贴合用户描述的 SKILL.md。对每个 skill：
- 根据偏好命名，例如 "verify-deep"、"session-report"、"deploy-sandbox"
- 使用用户访谈中的原话，加上阶段 2 发现的信息（测试命令、报告格式、部署目标）编写正文。如果该偏好映射到一个已有 bundled skill（例如 \`/verify\`），写一个项目 skill，在 bundled skill 基础上添加用户特定约束；告诉用户 bundled skill 仍然存在，而这个 skill 是补充。
- 如果偏好信息不足，快速追问，例如 "verify-deep 应该运行哪个测试命令？"

**然后在发现以下情况时，建议额外 skills**：
- 面向特定任务的参考知识（某个子系统的约定、模式、风格指南）
- 用户会想直接触发的可重复工作流（部署、修 issue、发布流程、验证变更）

对每个建议的 skill，提供：名称、一句话用途、为什么适合此 repo。

如果 \`.claude/skills/\` 已存在 skills，先审查它们。不要覆盖已有 skills；只建议与现有内容互补的新 skill。

在 \`.claude/skills/<skill-name>/SKILL.md\` 创建每个 skill：

\`\`\`yaml
---
name: <skill-name>
description: <what the skill does and when to use it>
---

<Instructions for Claude>
\`\`\`

默认情况下，用户（\`/<skill-name>\`）和 Claude 都能调用 skills。对于有副作用的工作流，例如 \`/deploy\`、\`/fix-issue 123\`，添加 \`disable-model-invocation: true\`，让只有用户能触发，并用 \`$ARGUMENTS\` 接收输入。

## 阶段 7：建议其他优化

告诉用户：既然 CLAUDE.md 和 skills（如果选择了）已经就绪，你现在会建议几个额外优化。

检查环境，并针对发现的每个缺口询问用户（使用 AskUserQuestion）：

- **GitHub CLI**：运行 \`which gh\`（Windows 上用 \`where gh\`）。如果缺失，且项目使用 GitHub（检查 \`git remote -v\` 是否含 github.com），询问用户是否想安装它。说明 GitHub CLI 能让 Claude 直接帮助处理 commit、pull request、issue 和 code review。

- **Linting**：如果阶段 2 没找到 lint 配置（针对项目语言没有 .eslintrc、ruff.toml、.golangci.yml 等），询问用户是否想让 Claude 为该代码库设置 linting。说明 linting 能提前捕获问题，并让 Claude 对自己的编辑获得快速反馈。

- **来自提案的 hooks**（如果用户选择 "Skills + hooks" 或 "仅 hooks"）：消费阶段 3 偏好队列里的 \`hook\` 项。如果阶段 2 发现 formatter 且队列中没有格式化 hook，把 format-on-edit 作为 fallback 提供。如果用户在阶段 1 选择 "都不要" 或 "仅 skills"，完全跳过这一条。

  对每个 hook 偏好（来自队列或 formatter fallback）：

  1. 目标文件：默认基于阶段 1 的 CLAUDE.md 选择。项目 -> \`.claude/settings.json\`（团队共享、提交）；个人 -> \`.claude/settings.local.json\`。只有当用户在阶段 1 选择 "两者都选" 或偏好不明确时才询问。所有 hooks 只问一次，不要逐个问。

  2. 根据偏好选择 event 和 matcher：
     - "每次编辑后" -> \`PostToolUse\`，matcher 为 \`Write|Edit\`
     - "Claude 完成时" / "我 review 前" -> \`Stop\` event（每轮结束触发，包括只读轮次）
     - "运行 bash 前" -> \`PreToolUse\`，matcher 为 \`Bash\`
     - "提交前"（字面 git-commit gate）-> **不是 hooks.json hook。** Matchers 不能按命令内容过滤 Bash，所以无法只匹配 \`git commit\`。把它转为 git pre-commit hook（\`.git/hooks/pre-commit\`、husky、pre-commit framework）并主动提出帮忙写。如果用户实际意思是 "在我 review 并提交 Claude 输出前"，那是 \`Stop\`；需要追问消歧。
     如果偏好含糊，请追问。

  3. **加载 hook 参考**（每次 \`/init\` 运行只加载一次，在第一个 hook 前）：调用 Skill 工具，传入 \`skill: 'update-config'\`，args 以 \`[hooks-only]\` 开头，后面接一句你正在构建什么，例如 \`[hooks-only] Constructing a PostToolUse/Write|Edit format hook for .claude/settings.json using ruff\`。这会把 hooks schema 和验证流程加载到上下文。后续 hooks 复用它；不要重复调用。

  4. 遵循该 skill 的 **"Constructing a Hook"** 流程：去重检查 -> 针对此项目构建 -> pipe-test raw -> wrap -> 写 JSON -> \`jq -e\` 校验 -> live-proof（对 \`Pre|PostToolUse\` 且可触发 matcher）-> cleanup -> handoff。目标文件和 event/matcher 来自步骤 1-2。

对每个 "yes" 先执行，再继续下一个。

## 阶段 8：总结和下一步

回顾已设置内容：写了哪些文件，以及每个文件包含的关键点。提醒用户这些文件是起点：他们应审阅和调整，并且可以随时再次运行 \`/init\` 重新扫描。

然后告诉用户：你会基于发现继续给出一些优化代码库和 Claude Code 设置的建议。把建议呈现为一个格式良好的 todo list，每项都必须与此 repo 相关。最有影响的放在前面。

构建列表时检查以下内容，并只包含适用项：
- 如果检测到前端代码（React、Vue、Svelte 等）：\`/plugin install frontend-design@claude-plugins-official\` 能为 Claude 提供设计原则和组件模式，让它产出更精致的 UI；\`/plugin install playwright@claude-plugins-official\` 让 Claude 打开真实浏览器、截图检查自己构建的内容，并自行修复视觉问题。
- 如果阶段 7 发现缺口（缺 GitHub CLI、缺 linting）且用户拒绝：在这里列出，并用一句话说明每项为何有帮助。
- 如果测试缺失或稀疏：建议设置测试框架，让 Claude 能验证自己的变更。
- 为帮助你创建 skills 并用 evals 优化已有 skills，Claude Code 有官方 skill-creator 插件。安装方式：\`/plugin install skill-creator@claude-plugins-official\`，然后运行 \`/skill-creator <skill-name>\` 创建新 skills 或改进已有 skill。（始终包含这一项。）
- 通过 \`/plugin\` 浏览官方插件；这些插件会打包 skills、agents、hooks 和 MCP servers，可能对你有帮助。你也可以创建自定义插件并分享给其他人。（始终包含这一项。）`

const command = {
  type: 'prompt',
  name: 'init',
  get description() {
    return feature('NEW_INIT') &&
      (process.env.USER_TYPE === 'ant' ||
        isEnvTruthy(process.env.CLAUDE_CODE_NEW_INIT))
      ? '初始化新的 CLAUDE.md 文件，并可选初始化 skills/hooks 和代码库文档'
      : '初始化新的 CLAUDE.md 文件并写入代码库文档'
  },
  contentLength: 0, // Dynamic content
  progressMessage: '正在分析你的代码库',
  source: 'builtin',
  async getPromptForCommand() {
    maybeMarkProjectOnboardingComplete()

    return [
      {
        type: 'text',
        text:
          feature('NEW_INIT') &&
          (process.env.USER_TYPE === 'ant' ||
            isEnvTruthy(process.env.CLAUDE_CODE_NEW_INIT))
            ? NEW_INIT_PROMPT
            : OLD_INIT_PROMPT,
      },
    ]
  },
} satisfies Command

export default command
