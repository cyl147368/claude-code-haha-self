import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = '在任务列表中创建新任务'

export function getPrompt(): string {
  const teammateContext = isAgentSwarmsEnabled()
    ? '，并且可能分配给队友'
    : ''

  const teammateTips = isAgentSwarmsEnabled()
    ? `- 在 description 中包含足够细节，让另一个 agent 能理解并完成任务
- 新任务创建时 status 为 'pending' 且没有 owner。使用 TaskUpdate 的 \`owner\` 参数进行分配
`
    : ''

  return `使用此工具为当前编码会话创建结构化任务列表。这有助于跟踪进度、组织复杂任务，并向用户展示你做事周全。
它也能帮助用户了解任务进展以及他们请求的整体进度。

## 何时使用此工具

在以下场景主动使用此工具：

- 复杂多步骤任务：任务需要 3 个或更多明确步骤或操作
- 非平凡且复杂的任务：需要仔细规划或多项操作的任务${teammateContext}
- 计划模式：使用计划模式时，创建任务列表跟踪工作
- 用户明确要求 todo list：用户直接要求你使用任务列表
- 用户提供多个任务：用户给出一组待办事项（编号或逗号分隔）
- 收到新指令后：立即把用户需求记录为任务
- 开始处理任务时：开始前先把任务标记为 in_progress
- 完成任务后：标记为 completed，并添加实现中发现的后续任务

## 何时不要使用此工具

以下情况跳过此工具：
- 只有一个直接明了的任务
- 任务很琐碎，跟踪它没有组织收益
- 任务可在少于 3 个简单步骤内完成
- 任务纯粹是对话或信息咨询

注意：如果只有一个琐碎任务，不应使用此工具。此时直接完成任务更好。

## 任务字段

- **subject**：简短、可执行的祈使式标题（例如 "Fix authentication bug in login flow"）
- **description**：需要完成的内容
- **activeForm**（可选）：任务处于 in_progress 时 spinner 中显示的现在进行式（例如 "Fixing authentication bug"）。如果省略，spinner 会显示 subject。

所有任务创建时 status 都是 \`pending\`。

## 提示

- 创建任务时使用清晰、具体、描述结果的 subject
- 创建任务后，如有需要，使用 TaskUpdate 设置依赖关系（blocks/blockedBy）
${teammateTips}- 先检查 TaskList，避免创建重复任务
`
}
