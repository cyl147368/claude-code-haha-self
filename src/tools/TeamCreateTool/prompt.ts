export function getPrompt(): string {
  return `
# TeamCreate

## 何时使用

在以下情况主动使用此工具：
- 用户明确要求使用 team、swarm 或一组 agents
- 用户提到希望 agents 一起工作、协调或协作
- 任务足够复杂，可以从多个 agents 并行工作中获益（例如构建包含 frontend 和 backend 的 full-stack feature、在保持测试通过的同时重构代码库、实现包含研究/规划/编码阶段的多步骤项目）

拿不准某个任务是否值得使用 team 时，优先创建 team。

## 为队友选择 Agent Types

通过 Agent 工具生成 teammates 时，请根据 agent 完成任务所需工具选择 \`subagent_type\`。每种 agent type 都有不同的可用工具，请让 agent 与工作匹配：

- **只读 agents**（例如 Explore、Plan）不能编辑或写入文件。只把研究、搜索或规划任务分配给它们。绝不要分配实现工作。
- **全能力 agents**（例如 general-purpose）可以访问所有工具，包括文件编辑、写入和 bash。需要修改内容的任务使用这类 agent。
- 定义在 \`.claude/agents/\` 中的 **自定义 agents** 可能有自己的工具限制。查看它们的描述，理解它们能做什么和不能做什么。

为 teammate 选择 \`subagent_type\` 前，始终先查看 Agent 工具提示词中列出的 agent type 描述及其可用工具。

创建一个新 team 来协调多个 agents 共同处理项目。Teams 与任务列表一一对应（Team = TaskList）。

\`\`\`
{
  "team_name": "my-project",
  "description": "Working on feature X"
}
\`\`\`

这会创建：
- \`~/.claude/teams/{team-name}/config.json\` 中的 team 文件
- \`~/.claude/tasks/{team-name}/\` 中对应的任务列表目录

## Team 工作流

1. **创建 team**：使用 TeamCreate，这会同时创建 team 及其任务列表
2. **创建任务**：使用 Task 工具（TaskCreate、TaskList 等），它们会自动使用 team 的任务列表
3. **生成 teammates**：使用 Agent 工具，并传入 \`team_name\` 和 \`name\` 参数，创建加入 team 的 teammates
4. **分配任务**：使用 TaskUpdate 的 \`owner\` 把任务交给空闲 teammates
5. **Teammates 处理已分配任务**，并通过 TaskUpdate 标记完成
6. **Teammates 在轮次之间会变为空闲**：每轮结束后，teammates 会自动进入 idle 并发送通知。重要：对 idle teammates 保持耐心。在 idle 真正影响工作前，不要评论他们的 idle 状态。
7. **关闭 team**：任务完成后，通过 SendMessage 发送 \`message: {type: "shutdown_request"}\`，优雅关闭 teammates。

## 任务所有权

任务通过 TaskUpdate 的 \`owner\` 参数分配。任何 agent 都可以通过 TaskUpdate 设置或更改任务所有权。

## 自动消息投递

**重要**：来自 teammates 的消息会自动投递给你。你不需要手动检查 inbox。

当你生成 teammates 时：
- 他们完成任务或需要帮助时会给你发消息
- 这些消息会自动作为新的对话轮次出现（类似用户消息）
- 如果你正忙（在当前轮次中），消息会排队，并在你的轮次结束后投递
- 当有消息等待时，UI 会显示带发送者名称的简短通知

消息会自动投递。

报告 teammate 消息时，不需要引用原始消息，因为它已经渲染给用户。

## Teammate Idle 状态

Teammates 每轮结束后都会进入 idle，这是完全正常且预期的。teammate 发消息后立刻 idle，不代表他们完成了或不可用。Idle 只表示他们正在等待输入。

- **Idle teammates 可以接收消息。** 给 idle teammate 发消息会唤醒他们，他们会正常处理。
- **Idle 通知是自动的。** teammate 的轮次结束时，系统会发送 idle 通知。除非你想分配新工作或发送后续消息，否则不需要响应 idle 通知。
- **不要把 idle 当作错误。** teammate 发消息后进入 idle 是正常流程。他们发出了消息，现在正在等待响应。
- **Peer DM 可见性。** 当 teammate 向另一个 teammate 发送 DM 时，简短摘要会包含在其 idle 通知中。这让你能了解同伴协作情况，而无需看到完整消息内容。你不需要回应这些摘要，它们只是信息。

## 发现 Team Members

Teammates 可以读取 team config 文件来发现其他 team members：
- **Team config 位置**：\`~/.claude/teams/{team-name}/config.json\`

config 文件包含 \`members\` 数组，其中每个 teammate 有：
- \`name\`：人类可读名称（消息和任务分配时**始终使用这个**）
- \`agentId\`：唯一标识符（仅供参考，不要用于沟通）
- \`agentType\`：agent 的角色/类型

**重要**：始终用 teammates 的 NAME 称呼他们（例如 "team-lead"、"researcher"、"tester"）。Names 用于：
- 发送消息时的 \`to\`
- 识别任务 owners

读取 team config 示例：
\`\`\`
使用 Read 工具读取 ~/.claude/teams/{team-name}/config.json
\`\`\`

## 任务列表协调

Teams 共享一个任务列表，所有 teammates 都可访问：\`~/.claude/tasks/{team-name}/\`。

Teammates 应该：
1. 定期检查 TaskList，**尤其是在完成每个任务后**，以寻找可用工作或新解除阻塞的任务
2. 使用 TaskUpdate 认领未分配、未阻塞的任务（将 \`owner\` 设置为你的名字）。当有多个可用任务时，**优先按 ID 顺序处理**（最低 ID 优先），因为较早任务通常会为后续任务建立上下文
3. 发现额外工作时，用 \`TaskCreate\` 创建新任务
4. 完成后用 \`TaskUpdate\` 标记任务完成，然后检查 TaskList 获取下一个工作
5. 通过读取任务列表状态与其他 teammates 协调
6. 如果所有可用任务都被阻塞，通知 team lead 或帮助解决阻塞任务

**与你的 team 沟通时的重要说明**：
- 不要使用终端工具查看 team 活动；始终向 teammates 发送消息（并记住，用 name 称呼他们）。
- 如果你不使用 SendMessage 工具，你的 team 听不到你。回应 teammates 时，始终向他们发送消息。
- 不要发送类似 \`{"type":"idle",...}\` 或 \`{"type":"task_completed",...}\` 的结构化 JSON 状态消息。需要给 teammates 发消息时，直接使用纯文本沟通。
- 使用 TaskUpdate 标记任务完成。
- 如果你是 team 中的 agent，当你停止时，系统会自动向 team lead 发送 idle 通知。

`.trim()
}
