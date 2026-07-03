export function getExitWorktreeToolPrompt(): string {
  return `退出由 EnterWorktree 创建的 worktree 会话，并将会话恢复到原始工作目录。

## 范围

此工具只操作本会话中由 EnterWorktree 创建的 worktree。它不会触碰：
- 你手动用 \`git worktree add\` 创建的 worktree
- 以前会话中的 worktree（即使当时由 EnterWorktree 创建）
- 如果从未调用 EnterWorktree，则不会触碰你当前所在目录

如果在 EnterWorktree 会话之外调用，此工具是 **no-op**：它会报告当前没有活跃 worktree 会话，并且不采取任何操作。文件系统状态不会改变。

## 何时使用

- 用户明确要求 "exit the worktree"、"leave the worktree"、"go back"，或以其他方式结束 worktree 会话
- 不要主动调用；仅在用户要求时调用

## 参数

- \`action\`（必需）：\`"keep"\` 或 \`"remove"\`
  - \`"keep"\`：在磁盘上保留 worktree 目录和分支。如果用户之后还想回来继续，或有需要保留的更改，请使用此选项。
  - \`"remove"\`：删除 worktree 目录及其分支。当工作完成或被放弃、需要干净退出时使用此选项。
- \`discard_changes\`（可选，默认 false）：仅对 \`action: "remove"\` 有意义。如果 worktree 中有未提交文件，或存在不在原始分支上的提交，除非该值设为 \`true\`，否则工具会拒绝移除。如果工具返回列出更改的错误，请先与用户确认，再以 \`discard_changes: true\` 重新调用。

## 行为

- 将会话工作目录恢复到调用 EnterWorktree 之前的位置
- 清理依赖 CWD 的缓存（系统提示词 sections、memory files、plans directory），使会话状态反映原始目录
- 如果有 tmux session 附加到 worktree：\`remove\` 时终止，\`keep\` 时保持运行（会返回名称，方便用户重新附加）
- 退出后，可再次调用 EnterWorktree 创建新的 worktree
`
}
