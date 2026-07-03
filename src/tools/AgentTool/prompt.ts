import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvDefinedFalsy, isEnvTruthy } from '../../utils/envUtils.js'
import { isTeammate } from '../../utils/teammate.js'
import { isInProcessTeammate } from '../../utils/teammateContext.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { SEND_MESSAGE_TOOL_NAME } from '../SendMessageTool/constants.js'
import { AGENT_TOOL_NAME } from './constants.js'
import { isForkSubagentEnabled } from './forkSubagent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

function getToolsDescription(agent: AgentDefinition): string {
  const { tools, disallowedTools } = agent
  const hasAllowlist = tools && tools.length > 0
  const hasDenylist = disallowedTools && disallowedTools.length > 0

  if (hasAllowlist && hasDenylist) {
    // Both defined: filter allowlist by denylist to match runtime behavior
    const denySet = new Set(disallowedTools)
    const effectiveTools = tools.filter(t => !denySet.has(t))
    if (effectiveTools.length === 0) {
      return '无'
    }
    return effectiveTools.join(', ')
  } else if (hasAllowlist) {
    // Allowlist only: show the specific tools available
    return tools.join(', ')
  } else if (hasDenylist) {
    // Denylist only: show "All tools except X, Y, Z"
    return `除 ${disallowedTools.join(', ')} 之外的所有工具`
  }
  // No restrictions
  return '所有工具'
}

/**
 * Format one agent line for the agent_listing_delta attachment message:
 * `- type: whenToUse (Tools: ...)`.
 */
export function formatAgentLine(agent: AgentDefinition): string {
  const toolsDescription = getToolsDescription(agent)
  return `- ${agent.agentType}: ${agent.whenToUse}（工具：${toolsDescription}）`
}

/**
 * Whether the agent list should be injected as an attachment message instead
 * of embedded in the tool description. When true, getPrompt() returns a static
 * description and attachments.ts emits an agent_listing_delta attachment.
 *
 * The dynamic agent list was ~10.2% of fleet cache_creation tokens: MCP async
 * connect, /reload-plugins, or permission-mode changes mutate the list →
 * description changes → full tool-schema cache bust.
 *
 * Override with CLAUDE_CODE_AGENT_LIST_IN_MESSAGES=true/false for testing.
 */
export function shouldInjectAgentListInMessages(): boolean {
  if (isEnvTruthy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES)) return true
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES))
    return false
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_agent_list_attach', false)
}

export async function getPrompt(
  agentDefinitions: AgentDefinition[],
  isCoordinator?: boolean,
  allowedAgentTypes?: string[],
): Promise<string> {
  // Filter agents by allowed types when Agent(x,y) restricts which agents can be spawned
  const effectiveAgents = allowedAgentTypes
    ? agentDefinitions.filter(a => allowedAgentTypes.includes(a.agentType))
    : agentDefinitions

  // Fork subagent feature: when enabled, insert the "When to fork" section
  // (fork semantics, directive-style prompts) and swap in fork-aware examples.
  const forkEnabled = isForkSubagentEnabled()

  const whenToForkSection = forkEnabled
    ? `

## 何时 fork

当中间工具输出不值得保留在你的上下文中时，fork 你自己（省略 \`subagent_type\`）。判断标准是定性的：“我之后还会需要这些输出吗？”而不是任务大小。
- **研究**：开放式问题适合 fork。如果研究可以拆成独立问题，请在一条消息中启动并行 forks。此时 fork 优于全新 subagent，因为它继承上下文并共享你的 cache。
- **实现**：需要超过几处编辑的实现工作，优先考虑 fork。进入实现前先做研究。

Fork 成本低，因为它们共享你的 prompt cache。不要给 fork 设置 \`model\`，不同模型无法复用父级 cache。传入短 \`name\`（一两个小写单词），让用户能在 teams 面板中看到 fork，并可在运行中引导它。

**不要偷看。** 工具结果包含 \`output_file\` 路径。除非用户明确要求检查进度，否则不要 Read 或 tail 它。你会收到完成通知，请信任通知。运行中读取 transcript 会把 fork 的工具噪声拉进你的上下文，违背 fork 的目的。

**不要抢跑。** 启动后，你并不知道 fork 发现了什么。绝不要以任何形式编造或预测 fork 结果，无论是 prose、summary 还是结构化输出。通知会在后续轮次以 user-role message 到达，绝不是你自己写出来的东西。如果用户在通知到达前追问，请告诉他们 fork 仍在运行，给状态，不要猜测。

**编写 fork prompt。** 由于 fork 继承你的上下文，prompt 是一个 *directive*，说明要做什么，而不是重新说明情况。范围要具体：包含什么、不包含什么、其他 agent 正在处理什么。不要重复解释背景。
`
    : ''

  const writingThePromptSection = `

## 编写 prompt

${forkEnabled ? '生成全新 agent（带 `subagent_type`）时，它从零上下文开始。' : ''}像给刚走进房间的聪明同事交代工作一样 brief agent：它没看过这段对话，不知道你试过什么，也不理解为什么这个任务重要。
- 说明你想完成什么，以及为什么。
- 描述你已经了解到或排除掉的内容。
- 给出足够的问题背景，让 agent 能做判断，而不是只执行狭窄指令。
- 如果你需要简短回复，请明确说明（例如 "report in under 200 words"）。
- 查询类任务：交给它精确命令。调查类任务：交给它问题；当前提错误时，规定步骤会变成负担。

${forkEnabled ? '对全新 agents 来说，简短的' : '简短的'}命令式 prompts 会产生浅层、泛泛的工作。

**绝不要委托理解。** 不要写 "based on your findings, fix the bug" 或 "based on the research, implement it." 这类话会把综合理解推给 agent，而不是由你完成。请写出能证明你已理解的 prompts：包含文件路径、行号、具体要改什么。
`

  const forkExamples = `使用示例：

<example>
user: "What's left on this branch before we can ship?"
assistant: <thinking>我要 fork 这个任务。这是一个调查问题，我想要 punch list，而不是把 git 输出放进我的上下文。</thinking>
${AGENT_TOOL_NAME}({
  name: "ship-audit",
  description: "Branch ship-readiness audit",
  prompt: "Audit what's left before this branch can ship. Check: uncommitted changes, commits ahead of main, whether tests exist, whether the GrowthBook gate is wired up, whether CI-relevant files changed. Report a punch list \u2014 done vs. missing. Under 200 words."
})
assistant: Ship-readiness audit 正在运行。
<commentary>
本轮到这里结束。coordinator 还不知道发现了什么。后面是单独一轮，通知会从外部以 user-role message 到达，不是 coordinator 自己写的内容。
</commentary>
[后续轮次：通知作为用户消息到达]
assistant: Audit 回来了。有三个 blockers：新 prompt path 没有测试，GrowthBook gate 已接线但未写入 build_flags.yaml，还有一个未提交文件。
</example>

<example>
user: "so is the gate wired up or not"
<commentary>
用户在等待期间询问。audit fork 正是为了回答这个问题启动的，但它尚未返回。coordinator 没有答案。给状态，不要编造结果。
</commentary>
assistant: 还在等 audit，它正在检查这件事。应该很快会回来。
</example>

<example>
user: "Can you get a second opinion on whether this migration is safe?"
assistant: <thinking>我会请 code-reviewer agent 看一下。它不会看到我的分析，因此能给出独立判断。</thinking>
<commentary>
指定了 subagent_type，因此 agent 从零开始。prompt 需要完整上下文。briefing 说明要评估什么以及为什么。
</commentary>
${AGENT_TOOL_NAME}({
  name: "migration-review",
  description: "Independent migration review",
  subagent_type: "code-reviewer",
  prompt: "Review migration 0042_user_schema.sql for safety. Context: we're adding a NOT NULL column to a 50M-row table. Existing rows get a backfill default. I want a second opinion on whether the backfill approach is safe under concurrent writes — I've checked locking behavior but want independent verification. Report: is this safe, and if not, what specifically breaks?"
})
</example>
`

  const currentExamples = `使用示例：

<example_agent_descriptions>
"test-runner": use this agent after you are done writing code to run tests
"greeting-responder": use this agent to respond to user greetings with a friendly joke
</example_agent_descriptions>

<example>
user: "Please write a function that checks if a number is prime"
assistant: 我会使用 ${FILE_WRITE_TOOL_NAME} 工具写入以下代码：
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
由于已经写入一段有意义的代码并完成任务，现在使用 test-runner agent 运行测试
</commentary>
assistant: 使用 ${AGENT_TOOL_NAME} 工具启动 test-runner agent
</example>

<example>
user: "Hello"
<commentary>
由于用户在打招呼，使用 greeting-responder agent 以友好的玩笑回应
</commentary>
assistant: "我会使用 ${AGENT_TOOL_NAME} 工具启动 greeting-responder agent"
</example>
`

  // When the gate is on, the agent list lives in an agent_listing_delta
  // attachment (see attachments.ts) instead of inline here. This keeps the
  // tool description static across MCP/plugin/permission changes so the
  // tools-block prompt cache doesn't bust every time an agent loads.
  const listViaAttachment = shouldInjectAgentListInMessages()

  const agentListSection = listViaAttachment
    ? `可用 agent types 会列在对话中的 <system-reminder> 消息里。`
    : `可用 agent types 以及它们可访问的工具：
${effectiveAgents.map(agent => formatAgentLine(agent)).join('\n')}`

  // Shared core prompt used by both coordinator and non-coordinator modes
  const shared = `启动一个新 agent，自主处理复杂、多步骤任务。

${AGENT_TOOL_NAME} 工具会启动专门的 agents（子进程），它们可以自主处理复杂任务。每种 agent type 都有特定能力和可用工具。

${agentListSection}

${
  forkEnabled
    ? `使用 ${AGENT_TOOL_NAME} 工具时，指定 subagent_type 可使用专门 agent；省略它则 fork 你自己，fork 会继承你的完整会话上下文。`
    : `使用 ${AGENT_TOOL_NAME} 工具时，指定 subagent_type 参数选择要使用的 agent type。如省略，则使用 general-purpose agent。`
}`

  // Coordinator mode gets the slim prompt -- the coordinator system prompt
  // already covers usage notes, examples, and when-not-to-use guidance.
  if (isCoordinator) {
    return shared
  }

  // Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so point at find via Bash instead.
  const embedded = hasEmbeddedSearchTools()
  const fileSearchHint = embedded
    ? '`find` via the Bash tool'
    : `the ${GLOB_TOOL_NAME} tool`
  // The "class Foo" example is about content search. Non-embedded stays Glob
  // (original intent: find-the-file-containing). Embedded gets grep because
  // find -name doesn't look at file contents.
  const contentSearchHint = embedded
    ? '`grep` via the Bash tool'
    : `the ${GLOB_TOOL_NAME} tool`
  const whenNotToUseSection = forkEnabled
    ? ''
    : `
何时不要使用 ${AGENT_TOOL_NAME} 工具：
- 如果你想读取特定文件路径，请使用 ${FILE_READ_TOOL_NAME} 工具或 ${fileSearchHint}，而不是 ${AGENT_TOOL_NAME} 工具，以便更快找到匹配项
- 如果你在搜索类似 "class Foo" 的特定 class 定义，请改用 ${contentSearchHint}，以便更快找到匹配项
- 如果你在特定文件或 2-3 个文件集合中搜索代码，请使用 ${FILE_READ_TOOL_NAME} 工具，而不是 ${AGENT_TOOL_NAME} 工具，以便更快找到匹配项
- 其他与上方 agent 描述无关的任务
`

  // When listing via attachment, the "launch multiple agents" note is in the
  // attachment message (conditioned on subscription there). When inline, keep
  // the existing per-call getSubscriptionType() check.
  const concurrencyNote =
    !listViaAttachment && getSubscriptionType() !== 'pro'
      ? `
- 尽可能并发启动多个 agents 以最大化性能；为此，请在一条消息中使用多个工具调用`
      : ''

  // Non-coordinator gets the full prompt with all sections
  return `${shared}
${whenNotToUseSection}

使用说明：
- 始终包含一个简短 description（3-5 个词），总结 agent 将做什么${concurrencyNote}
- agent 完成后，会向你返回一条消息。agent 返回的结果对用户不可见。若要向用户展示结果，你应向用户发送一条简洁总结结果的文本消息。${
    // eslint-disable-next-line custom-rules/no-process-env-top-level
    !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS) &&
    !isInProcessTeammate() &&
    !forkEnabled
      ? `
- 你可以选择用 run_in_background 参数让 agents 在后台运行。当 agent 在后台运行时，完成后你会自动收到通知；不要 sleep、poll 或主动检查进度。请继续其他工作或回复用户。
- **Foreground vs background**：当你需要 agent 结果才能继续时，使用 foreground（默认），例如研究 agent 的发现会决定你的下一步。若你有真正独立的工作可并行处理，请使用 background。`
      : ''
  }
- 要继续之前生成的 agent，请使用 ${SEND_MESSAGE_TOOL_NAME}，并将 agent 的 ID 或名称作为 \`to\` 字段。agent 会在完整上下文保留的情况下恢复。${forkEnabled ? '每次带 subagent_type 的全新 Agent 调用都会在无上下文状态开始，请提供完整任务描述。' : '每次 Agent 调用都是全新开始，请提供完整任务描述。'}
- 通常应信任 agent 的输出
- 清楚告诉 agent 你期望它写代码，还是只做研究（搜索、读取文件、web fetches 等）${forkEnabled ? '' : '，因为它并不知道用户意图'}
- 如果 agent 描述提到应主动使用它，请尽力在用户不必要求的情况下使用它。自行判断。
- 如果用户明确希望你 "in parallel" 运行 agents，你必须发送一条包含多个 ${AGENT_TOOL_NAME} 工具调用内容块的消息。例如，如果需要并行启动 build-validator agent 和 test-runner agent，请在一条消息中包含两个工具调用。
- 你可以选择设置 \`isolation: "worktree"\`，让 agent 在临时 git worktree 中运行，从而获得仓库的隔离副本。如果 agent 未做更改，worktree 会自动清理；如果做了更改，结果会返回 worktree 路径和分支。${
    process.env.USER_TYPE === 'ant'
      ? `\n- 你可以设置 \`isolation: "remote"\`，让 agent 在远程 CCR 环境中运行。这始终是后台任务；完成时你会收到通知。适用于需要全新 sandbox 的长时间运行任务。`
      : ''
  }${
    isInProcessTeammate()
      ? `
- 当前上下文中不可使用 run_in_background、name、team_name 和 mode 参数。仅支持同步 subagents。`
      : isTeammate()
        ? `
- 当前上下文中不可使用 name、team_name 和 mode 参数。teammates 不能生成其他 teammates。省略这些参数以生成 subagent。`
        : ''
  }${whenToForkSection}${writingThePromptSection}

${forkEnabled ? forkExamples : currentExamples}`
}
