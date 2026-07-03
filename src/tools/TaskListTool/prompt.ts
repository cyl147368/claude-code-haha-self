import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'

export const DESCRIPTION = '列出任务列表中的所有任务'

export function getPrompt(): string {
  const teammateUseCase = isAgentSwarmsEnabled()
    ? `- 给队友分配任务前，用来查看有哪些可用任务
`
    : ''

  const idDescription = isAgentSwarmsEnabled()
    ? '- **id**：任务标识符（配合 TaskGet、TaskUpdate 使用）'
    : '- **id**：任务标识符（配合 TaskGet、TaskUpdate 使用）'

  const teammateWorkflow = isAgentSwarmsEnabled()
    ? `
## 队友工作流

作为队友工作时：
1. 完成当前任务后，调用 TaskList 查找可用工作
2. 查找 status 为 'pending'、没有 owner 且 blockedBy 为空的任务
3. 当有多个可用任务时，**优先按 ID 顺序处理**（最低 ID 优先），因为较早任务通常会为后续任务建立上下文
4. 使用 TaskUpdate 认领可用任务（将 \`owner\` 设置为你的名字），或等待 leader 分配
5. 如果被阻塞，专注于解除阻塞任务，或通知 team lead
`
    : ''

  return `使用此工具列出任务列表中的所有任务。

## 何时使用此工具

- 查看哪些任务可以处理（status: 'pending'、没有 owner、未被阻塞）
- 检查项目整体进度
- 找出被阻塞且需要解决依赖的任务
${teammateUseCase}- 完成任务后，检查是否有新解除阻塞的工作，或认领下一个可用任务
- 当有多个可用任务时，**优先按 ID 顺序处理**（最低 ID 优先），因为较早任务通常会为后续任务建立上下文

## 输出

返回每个任务的摘要：
${idDescription}
- **subject**：任务简要描述
- **status**：'pending'、'in_progress' 或 'completed'
- **owner**：如已分配则为 Agent ID；如可用则为空
- **blockedBy**：必须先解决的开放任务 ID 列表（带 blockedBy 的任务在依赖解决前不能认领）

使用 TaskGet 和具体任务 ID 查看完整详情，包括 description 和 comments。
${teammateWorkflow}`
}
