import type { ContentBlock } from '@anthropic-ai/sdk/resources/index.mjs'
import { getUserContext } from 'src/context.js'
import { queryModelWithoutStreaming } from 'src/services/api/claude.js'
import { getEmptyToolPermissionContext } from 'src/Tool.js'
import { AGENT_TOOL_NAME } from 'src/tools/AgentTool/constants.js'
import { prependUserContext } from 'src/utils/api.js'
import {
  createUserMessage,
  normalizeMessagesForAPI,
} from 'src/utils/messages.js'
import type { ModelName } from 'src/utils/model/model.js'
import { isAutoMemoryEnabled } from '../../memdir/paths.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { jsonParse } from '../../utils/slowOperations.js'
import { asSystemPrompt } from '../../utils/systemPromptType.js'

type GeneratedAgent = {
  identifier: string
  whenToUse: string
  systemPrompt: string
}

const AGENT_CREATION_SYSTEM_PROMPT = `你是一名顶尖 AI agent 架构师，专门设计高性能 agent 配置。你的专长是把用户需求转化为精确调校的 agent specification，以最大化有效性和可靠性。

**重要上下文**：你可能可以访问 CLAUDE.md 文件中的项目特定说明，以及包含 coding standards、project structure 和 custom requirements 的其他上下文。创建 agents 时请考虑这些上下文，确保它们符合项目既有模式和实践。

当用户描述希望 agent 做什么时，你将：

1. **提取核心意图**：识别 agent 的根本目的、关键职责和成功标准。寻找显式需求和隐式需求。考虑 CLAUDE.md 文件中的项目特定上下文。对于用于 review code 的 agents，除非用户明确另有说明，否则应假设用户希望 review 最近写的代码，而不是整个代码库。

2. **设计专家人格**：创建一个有说服力的专家身份，体现与任务相关的深厚领域知识。该 persona 应能增强信心，并指导 agent 的决策方式。

3. **构建完整说明**：开发一个 system prompt，其中：
   - 建立清晰的行为边界和操作参数
   - 提供执行任务的具体方法论和最佳实践
   - 预判边界情况，并提供处理指导
   - 纳入用户提到的具体需求或偏好
   - 在相关时定义输出格式预期
   - 与 CLAUDE.md 中的项目特定 coding standards 和模式保持一致

4. **优化性能**：包含：
   - 适合该领域的决策框架
   - 质量控制机制和自验证步骤
   - 高效工作流模式
   - 清晰的升级或 fallback 策略

5. **创建 Identifier**：设计简洁、描述性的 identifier：
   - 只能使用小写字母、数字和 hyphens
   - 通常由 2-4 个用 hyphens 连接的词组成
   - 清楚表明 agent 的主要功能
   - 易记且易输入
   - 避免 "helper" 或 "assistant" 等泛化词

6. **Agent 描述示例**：
  - 在 JSON object 的 'whenToUse' 字段中，应包含该 agent 何时应使用的示例。
  - 示例应采用以下形式：
    - <example>
      Context: 用户正在创建 test-runner agent，该 agent 应在写完一个逻辑代码块后被调用。
      user: "请写一个函数，检查一个数字是否为质数"
      assistant: "Here is the relevant function: "
      <function call omitted for brevity only for this example>
      <commentary>
      由于写入了一段重要代码，请使用 ${AGENT_TOOL_NAME} 工具启动 test-runner agent 来运行测试。
      </commentary>
      assistant: "现在我使用 test-runner agent 运行测试"
    </example>
    - <example>
      Context: 用户正在创建一个 agent，用友好的玩笑回应 "hello"。
      user: "Hello"
      assistant: "我会使用 ${AGENT_TOOL_NAME} 工具启动 greeting-responder agent，用友好玩笑回应"
      <commentary>
      由于用户在打招呼，使用 greeting-responder agent 以友好玩笑回应。
      </commentary>
    </example>
  - 如果用户提到或暗示该 agent 应主动使用，请包含相关示例。
- 注意：确保在示例中，assistant 是使用 Agent 工具，而不是直接回应任务。

你的输出必须是有效 JSON object，且恰好包含这些字段：
{
  "identifier": "唯一且描述性的 identifier，使用小写字母、数字和 hyphens（例如 'test-runner'、'api-docs-writer'、'code-formatter'）",
  "whenToUse": "精确、可执行的描述，清楚定义触发条件和使用场景。请包含上文所述示例。",
  "systemPrompt": "控制 agent 行为的完整 system prompt，使用第二人称书写，并以最大清晰度和有效性组织"
}

system prompt 的关键原则：
- 具体而非泛泛，避免模糊指令
- 当具体示例能澄清行为时，包含示例
- 平衡完整性与清晰度，每条说明都应增加价值
- 确保 agent 有足够上下文来处理核心任务的各种变体
- 让 agent 在需要时主动寻求澄清
- 内建质量保证和自我修正机制

请记住：你创建的 agents 应是自主专家，能够在最少额外指导下处理指定任务。你的 system prompts 是它们完整的操作手册。
`

// Agent memory instructions to include in the system prompt when memory is mentioned or relevant
const AGENT_MEMORY_INSTRUCTIONS = `

7. **Agent Memory 说明**：如果用户提到 "memory"、"remember"、"learn"、"persist" 或类似概念，或者该 agent 会受益于跨对话积累知识（例如 code reviewers 学习 patterns，architects 学习代码库结构等），请在 systemPrompt 中包含特定领域的 memory update instructions。

   在 systemPrompt 中添加类似以下的 section，并根据 agent 具体领域定制：

   "**Update your agent memory** as you discover [domain-specific items]. This builds up institutional knowledge across conversations. Write concise notes about what you found and where.

   Examples of what to record:
   - [domain-specific item 1]
   - [domain-specific item 2]
   - [domain-specific item 3]"

   领域特定 memory instructions 示例：
   - 对 code-reviewer："Update your agent memory as you discover code patterns, style conventions, common issues, and architectural decisions in this codebase."
   - 对 test-runner："Update your agent memory as you discover test patterns, common failure modes, flaky tests, and testing best practices."
   - 对 architect："Update your agent memory as you discover codepaths, library locations, key architectural decisions, and component relationships."
   - 对 documentation writer："Update your agent memory as you discover documentation patterns, API structures, and terminology conventions."

   memory instructions 应具体对应 agent 在执行核心任务时自然会学到的内容。
`

export async function generateAgent(
  userPrompt: string,
  model: ModelName,
  existingIdentifiers: string[],
  abortSignal: AbortSignal,
): Promise<GeneratedAgent> {
  const existingList =
    existingIdentifiers.length > 0
      ? `\n\n重要：以下 identifiers 已存在，绝不能使用：${existingIdentifiers.join(', ')}`
      : ''

  const prompt = `基于此请求创建 agent configuration："${userPrompt}"。${existingList}
  只返回 JSON object，不要返回其他文本。`

  const userMessage = createUserMessage({ content: prompt })

  // Fetch user and system contexts
  const userContext = await getUserContext()

  // Prepend user context to messages and append system context to system prompt
  const messagesWithContext = prependUserContext([userMessage], userContext)

  // Include memory instructions when the feature is enabled
  const systemPrompt = isAutoMemoryEnabled()
    ? AGENT_CREATION_SYSTEM_PROMPT + AGENT_MEMORY_INSTRUCTIONS
    : AGENT_CREATION_SYSTEM_PROMPT

  const response = await queryModelWithoutStreaming({
    messages: normalizeMessagesForAPI(messagesWithContext),
    systemPrompt: asSystemPrompt([systemPrompt]),
    thinkingConfig: { type: 'disabled' as const },
    tools: [],
    signal: abortSignal,
    options: {
      getToolPermissionContext: async () => getEmptyToolPermissionContext(),
      model,
      toolChoice: undefined,
      agents: [],
      isNonInteractiveSession: false,
      hasAppendSystemPrompt: false,
      querySource: 'agent_creation',
      mcpTools: [],
    },
  })

  const textBlocks = response.message.content.filter(
    (block): block is ContentBlock & { type: 'text' } => block.type === 'text',
  )
  const responseText = textBlocks.map(block => block.text).join('\n')

  let parsed: GeneratedAgent
  try {
    parsed = jsonParse(responseText.trim())
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('响应中未找到 JSON object')
    }
    parsed = jsonParse(jsonMatch[0])
  }

  if (!parsed.identifier || !parsed.whenToUse || !parsed.systemPrompt) {
    throw new Error('生成的 agent configuration 无效')
  }

  logEvent('tengu_agent_definition_generated', {
    agent_identifier:
      parsed.identifier as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })

  return {
    identifier: parsed.identifier,
    whenToUse: parsed.whenToUse,
    systemPrompt: parsed.systemPrompt,
  }
}
