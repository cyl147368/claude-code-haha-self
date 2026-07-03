import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'
import { isUltrareviewEnabled } from './review/ultrareviewEnabled.js'

// 法务要求在用户触发前显式展示产品面名称和文档链接。
const CCR_TERMS_URL = 'https://code.claude.com/docs/en/claude-code-on-the-web'

const LOCAL_REVIEW_PROMPT = (args: string) => `
      你是一名资深代码评审专家。请按以下步骤执行：

      1. 如果 args 中没有提供 PR 编号，运行 \`gh pr list\` 展示打开的 PR
      2. 如果提供了 PR 编号，运行 \`gh pr view <number>\` 获取 PR 详情
      3. 运行 \`gh pr diff <number>\` 获取 diff
      4. 分析变更，并给出完整但聚焦的代码评审，包含：
         - PR 做了什么的概览
         - 代码质量和风格分析
         - 具体改进建议
         - 潜在问题或风险

      评审要简洁但充分。重点关注：
      - 代码正确性
      - 是否符合项目约定
      - 性能影响
      - 测试覆盖
      - 安全考虑

      使用清晰的小节和要点组织评审。

      PR 编号：${args}
    `

const review: Command = {
  type: 'prompt',
  name: 'review',
  description: '评审 pull request',
  progressMessage: '正在评审 pull request',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return [{ type: 'text', text: LOCAL_REVIEW_PROMPT(args) }]
  },
}

// /ultrareview 是远程 bughunter 路径的唯一入口；/review 保持纯本地。
// local-jsx 类型会在免费评审额度耗尽时渲染超额使用权限对话框。
const ultrareview: Command = {
  type: 'local-jsx',
  name: 'ultrareview',
  description: `约 10-20 分钟 · 查找并验证当前分支中的 bug。在 Claude Code on the web 中运行。详见 ${CCR_TERMS_URL}`,
  isEnabled: () => isUltrareviewEnabled(),
  load: () => import('./review/ultrareviewCommand.js'),
}

export default review
export { ultrareview }
