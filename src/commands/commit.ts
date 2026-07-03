import type { Command } from '../commands.js'
import { getAttributionTexts } from '../utils/attribution.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'
import { getUndercoverInstructions, isUndercover } from '../utils/undercover.js'

const ALLOWED_TOOLS = [
  'Bash(git add:*)',
  'Bash(git status:*)',
  'Bash(git commit:*)',
]

function getPromptContent(): string {
  const { commit: commitAttribution } = getAttributionTexts()

  let prefix = ''
  if (process.env.USER_TYPE === 'ant' && isUndercover()) {
    prefix = getUndercoverInstructions() + '\n'
  }

  return `${prefix}## 上下文

- 当前 git 状态：!\`git status\`
- 当前 git diff（包含已暂存和未暂存变更）：!\`git diff HEAD\`
- 当前分支：!\`git branch --show-current\`
- 最近提交：!\`git log --oneline -10\`

## Git 安全协议

- 绝不要更新 git config
- 除非用户明确要求，否则绝不要跳过 hooks（--no-verify、--no-gpg-sign 等）
- 关键：始终创建新的 commit。除非用户明确要求，否则绝不要使用 git commit --amend
- 不要提交很可能包含密钥的文件（.env、credentials.json 等）。如果用户明确要求提交这些文件，要先警告用户
- 如果没有可提交的变更（没有未跟踪文件，也没有修改），不要创建空 commit
- 绝不要使用带 -i 的 git 命令（例如 git rebase -i 或 git add -i），因为它们需要不受支持的交互输入

## 你的任务

基于上述变更，创建一个 git commit：

1. 分析所有暂存变更并起草 commit message：
   - 查看上面的最近提交，遵循此仓库的 commit message 风格
   - 概括变更性质（新功能、增强、bug 修复、重构、测试、文档等）
   - 确保 message 准确反映变更和目的，例如 "add" 表示全新功能，"update" 表示增强既有功能，"fix" 表示 bug 修复
   - 起草简洁的 commit message（1-2 句话），重点说明为什么改，而不是只描述改了什么

2. 暂存相关文件，并使用 HEREDOC 语法创建 commit：
\`\`\`
git commit -m "$(cat <<'EOF'
这里写 commit message。${commitAttribution ? `\n\n${commitAttribution}` : ''}
EOF
)"
\`\`\`

你可以在同一条回复中调用多个工具。请在同一条消息里完成暂存和创建 commit。不要使用其他工具，也不要做其他事。除这些工具调用外，不要发送任何额外文本或消息。`
}

const command = {
  type: 'prompt',
  name: 'commit',
  description: '创建 git commit',
  allowedTools: ALLOWED_TOOLS,
  contentLength: 0, // Dynamic content
  progressMessage: '正在创建 commit',
  source: 'builtin',
  async getPromptForCommand(_args, context) {
    const promptContent = getPromptContent()
    const finalContent = await executeShellCommandsInPrompt(
      promptContent,
      {
        ...context,
        getAppState() {
          const appState = context.getAppState()
          return {
            ...appState,
            toolPermissionContext: {
              ...appState.toolPermissionContext,
              alwaysAllowRules: {
                ...appState.toolPermissionContext.alwaysAllowRules,
                command: ALLOWED_TOOLS,
              },
            },
          }
        },
      },
      '/commit',
    )

    return [{ type: 'text', text: finalContent }]
  },
} satisfies Command

export default command
