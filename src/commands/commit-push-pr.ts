import type { Command } from '../commands.js'
import {
  getAttributionTexts,
  getEnhancedPRAttribution,
} from '../utils/attribution.js'
import { getDefaultBranch } from '../utils/git.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'
import { getUndercoverInstructions, isUndercover } from '../utils/undercover.js'

const ALLOWED_TOOLS = [
  'Bash(git checkout --branch:*)',
  'Bash(git checkout -b:*)',
  'Bash(git add:*)',
  'Bash(git status:*)',
  'Bash(git push:*)',
  'Bash(git commit:*)',
  'Bash(gh pr create:*)',
  'Bash(gh pr edit:*)',
  'Bash(gh pr view:*)',
  'Bash(gh pr merge:*)',
  'ToolSearch',
  'mcp__slack__send_message',
  'mcp__claude_ai_Slack__slack_send_message',
]

function getPromptContent(
  defaultBranch: string,
  prAttribution?: string,
): string {
  const { commit: commitAttribution, pr: defaultPrAttribution } =
    getAttributionTexts()
  // 使用传入的 PR attribution；没有传入时退回默认值。
  const effectivePrAttribution = prAttribution ?? defaultPrAttribution
  const safeUser = process.env.SAFEUSER || ''
  const username = process.env.USER || ''

  let prefix = ''
  let reviewerArg = ' and `--reviewer anthropics/claude-code`'
  let addReviewerArg = ' (and add `--add-reviewer anthropics/claude-code`)'
  let changelogSection = `

## Changelog
<!-- CHANGELOG:START -->
[如果此 PR 包含用户可见变更，请在这里添加 changelog 条目。否则删除本节。]
<!-- CHANGELOG:END -->`
  let slackStep = `

5. 创建或更新 PR 后，检查用户的 CLAUDE.md 是否提到要发布到 Slack 频道。如果提到了，使用 ToolSearch 搜索 "slack send message" 工具。如果 ToolSearch 找到 Slack 工具，询问用户是否要把 PR URL 发布到相关 Slack 频道。只有用户确认后才发布。如果 ToolSearch 没有结果或报错，请静默跳过这一步；不要提及失败，不要尝试变通方案，也不要尝试替代方式。`
  if (process.env.USER_TYPE === 'ant' && isUndercover()) {
    prefix = getUndercoverInstructions() + '\n'
    reviewerArg = ''
    addReviewerArg = ''
    changelogSection = ''
    slackStep = ''
  }

  return `${prefix}## 上下文

- \`SAFEUSER\`: ${safeUser}
- \`whoami\`: ${username}
- \`git status\`: !\`git status\`
- \`git diff HEAD\`: !\`git diff HEAD\`
- \`git branch --show-current\`: !\`git branch --show-current\`
- \`git diff ${defaultBranch}...HEAD\`: !\`git diff ${defaultBranch}...HEAD\`
- \`gh pr view --json number 2>/dev/null || true\`: !\`gh pr view --json number 2>/dev/null || true\`

## Git 安全协议

- 绝不要更新 git config
- 除非用户明确要求，否则绝不要运行破坏性或不可逆的 git 命令（例如 push --force、hard reset 等）
- 除非用户明确要求，否则绝不要跳过 hooks（--no-verify、--no-gpg-sign 等）
- 绝不要对 main/master 执行 force push；如果用户要求这样做，先警告用户
- 不要提交很可能包含密钥的文件（.env、credentials.json 等）
- 绝不要使用带 -i 的 git 命令（例如 git rebase -i 或 git add -i），因为它们需要不受支持的交互输入

## 你的任务

分析将包含在 pull request 中的所有变更。请确保查看所有相关 commit，而不是只看最新 commit；也就是上面 git diff ${defaultBranch}...HEAD 输出中会进入 PR 的全部变更。

基于上述变更：
1. 如果当前在 ${defaultBranch} 上，创建一个新分支（使用上文 SAFEUSER 作为分支名前缀；如果 SAFEUSER 为空，则退回 whoami，例如 \`username/feature-name\`）
2. 使用 heredoc 语法创建一个带有合适 message 的 commit${commitAttribution ? `，并在结尾附上下面示例里的 attribution 文本` : ''}：
\`\`\`
git commit -m "$(cat <<'EOF'
这里写 commit message。${commitAttribution ? `\n\n${commitAttribution}` : ''}
EOF
)"
\`\`\`
3. 将分支 push 到 origin
4. 如果该分支已有 PR（检查上面的 gh pr view 输出），使用 \`gh pr edit\` 更新 PR 标题和正文，使其反映当前 diff${addReviewerArg}。否则，用 \`gh pr create\` 创建 pull request，并用 heredoc 语法填写 body${reviewerArg}。
   - 重要：PR 标题保持简短（少于 70 个字符）。细节写在正文里。
\`\`\`
gh pr create --title "简短、描述性标题" --body "$(cat <<'EOF'
## Summary
<1-3 个要点>

## Test plan
[用于测试此 pull request 的 markdown 待办清单...]${changelogSection}${effectivePrAttribution ? `\n\n${effectivePrAttribution}` : ''}
EOF
)"
\`\`\`

你可以在同一条回复中调用多个工具。你必须在同一条消息里完成以上所有步骤。${slackStep}

完成后返回 PR URL，方便用户查看。`
}

const command = {
  type: 'prompt',
  name: 'commit-push-pr',
  description: '提交、推送并打开 PR',
  allowedTools: ALLOWED_TOOLS,
  get contentLength() {
    // 用 'main' 估算 content length。
    return getPromptContent('main').length
  },
  progressMessage: '正在创建 commit 和 PR',
  source: 'builtin',
  async getPromptForCommand(args, context) {
    // 获取默认分支和增强 PR attribution。
    const [defaultBranch, prAttribution] = await Promise.all([
      getDefaultBranch(),
      getEnhancedPRAttribution(context.getAppState),
    ])
    let promptContent = getPromptContent(defaultBranch, prAttribution)

    // 如果有参数，追加用户指令。
    const trimmedArgs = args?.trim()
    if (trimmedArgs) {
      promptContent += `\n\n## 用户的附加指令\n\n${trimmedArgs}`
    }

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
      '/commit-push-pr',
    )

    return [{ type: 'text', text: finalContent }]
  },
} satisfies Command

export default command
