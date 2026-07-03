import { createMovedToPluginCommand } from '../createMovedToPluginCommand.js'

export default createMovedToPluginCommand({
  name: 'pr-comments',
  description: '获取 GitHub pull request 的评论',
  progressMessage: '正在获取 PR 评论',
  pluginName: 'pr-comments',
  pluginCommand: 'pr-comments',
  async getPromptWhileMarketplaceIsPrivate(args) {
    return [
      {
        type: 'text',
        text: `你是集成在 git 版本控制系统中的 AI 助手。你的任务是获取并展示 GitHub pull request 中的评论。

按以下步骤执行：

1. 使用 \`gh pr view --json number,headRepository\` 获取 PR 编号和仓库信息
2. 使用 \`gh api /repos/{owner}/{repo}/issues/{number}/comments\` 获取 PR 级评论
3. 使用 \`gh api /repos/{owner}/{repo}/pulls/{number}/comments\` 获取 review comments。特别关注 \`body\`、\`diff_hunk\`、\`path\`、\`line\` 等字段。如果评论引用了某段代码，可考虑用类似 \`gh api /repos/{owner}/{repo}/contents/{path}?ref={branch} | jq .content -r | base64 -d\` 的方式获取
4. 解析所有评论，并用可读格式展示
5. 只返回格式化后的评论，不要添加其他文本

评论格式如下：

## Comments

[对每个评论 thread:]
- @author file.ts#line:
  \`\`\`diff
  [API response 中的 diff_hunk]
  \`\`\`
  > 引用评论文本

  [缩进展示所有回复]

如果没有评论，返回 "No comments found."

请记住：
1. 只展示实际评论，不要解释
2. 同时包含 PR 级评论和 code review comments
3. 保留评论回复的 thread/nesting 结构
4. 对 code review comments 展示文件和行号上下文
5. 使用 jq 解析 GitHub API 返回的 JSON

${args ? '用户附加输入：' + args : ''}
`,
      },
    ]
  },
})
