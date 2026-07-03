export function getPrompt(): string {
  return `
# TeamDelete

当 swarm 工作完成时，移除 team 和 task 目录。

此操作会：
- 移除 team 目录（\`~/.claude/teams/{team-name}/\`）
- 移除 task 目录（\`~/.claude/tasks/{team-name}/\`）
- 从当前会话中清除 team 上下文

**重要**：如果 team 仍有活跃 members，TeamDelete 会失败。请先优雅终止 teammates，等所有 teammates 关闭后再调用 TeamDelete。

当所有 teammates 都完成工作，并且你想清理 team resources 时使用此工具。team name 会根据当前会话的 team 上下文自动确定。
`.trim()
}
