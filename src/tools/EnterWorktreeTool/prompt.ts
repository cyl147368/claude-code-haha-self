export function getEnterWorktreeToolPrompt(): string {
  return `仅当用户明确要求在 worktree 中工作时，才使用此工具。此工具会创建一个隔离的 git worktree，并将当前会话切换进去。

## 何时使用

- 用户明确提到 "worktree"（例如 "start a worktree"、"work in a worktree"、"create a worktree"、"use a worktree"）

## 何时不要使用

- 用户要求创建分支、切换分支或在其他分支上工作时，改用 git 命令
- 用户要求修 bug 或开发功能时，使用普通 git 工作流，除非他们明确提到 worktree
- 除非用户明确提到 "worktree"，否则绝不要使用此工具

## 要求

- 必须位于 git 仓库中，或在 settings.json 中配置了 WorktreeCreate/WorktreeRemove hooks
- 当前不能已经位于 worktree 中

## 行为

- 在 git 仓库中：基于 HEAD 创建新分支，并在 \`.claude/worktrees/\` 中创建新的 git worktree
- 在 git 仓库之外：委托 WorktreeCreate/WorktreeRemove hooks 实现与 VCS 无关的隔离
- 将会话工作目录切换到新的 worktree
- 会话中途可使用 ExitWorktree 离开 worktree（保留或移除）。会话退出时，如果仍在 worktree 中，会提示用户选择保留或移除

## 参数

- \`name\`（可选）：worktree 名称。如未提供，会生成随机名称。
`
}
