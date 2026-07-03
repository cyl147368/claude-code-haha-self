export const DESCRIPTION = '更新任务列表中的任务'

export const PROMPT = `使用此工具更新任务列表中的任务。

## 何时使用此工具

**将任务标记为已解决：**
- 当你完成了任务描述中的工作
- 当任务不再需要或已被其他任务取代
- 重要：完成分配给你的任务后，始终将其标记为已解决
- 解决后，调用 TaskList 查找下一个任务

- 只有在完全完成任务后，才将任务标记为 completed
- 如果遇到错误、阻塞或无法完成，请保持任务为 in_progress
- 被阻塞时，创建一个新任务说明需要解决什么
- 以下情况绝不要将任务标记为 completed：
  - 测试失败
  - 实现只是部分完成
  - 存在未解决错误
  - 找不到必要文件或依赖

**删除任务：**
- 当任务不再相关或是误创建时
- 将 status 设置为 \`deleted\` 会永久移除该任务

**更新任务详情：**
- 当需求变化或变得更清晰时
- 当需要建立任务之间的依赖关系时

## 可更新字段

- **status**：任务状态（见下方状态流程）
- **subject**：修改任务标题（祈使式，例如 "Run tests"）
- **description**：修改任务描述
- **activeForm**：任务 in_progress 时 spinner 中显示的现在进行式（例如 "Running tests"）
- **owner**：修改任务负责人（agent name）
- **metadata**：将 metadata keys 合并进任务（将某个 key 设为 null 可删除它）
- **addBlocks**：标记哪些任务必须等当前任务完成后才能开始
- **addBlockedBy**：标记当前任务必须等哪些任务完成后才能开始

## 状态流程

状态流转：\`pending\` → \`in_progress\` → \`completed\`

使用 \`deleted\` 永久移除任务。

## 最新状态

更新任务前，确保先用 \`TaskGet\` 读取任务最新状态。

## 示例

开始工作时将任务标记为进行中：
\`\`\`json
{"taskId": "1", "status": "in_progress"}
\`\`\`

完成工作后将任务标记为完成：
\`\`\`json
{"taskId": "1", "status": "completed"}
\`\`\`

删除任务：
\`\`\`json
{"taskId": "1", "status": "deleted"}
\`\`\`

通过设置 owner 认领任务：
\`\`\`json
{"taskId": "1", "owner": "my-name"}
\`\`\`

设置任务依赖：
\`\`\`json
{"taskId": "2", "addBlockedBy": ["1"]}
\`\`\`
`
