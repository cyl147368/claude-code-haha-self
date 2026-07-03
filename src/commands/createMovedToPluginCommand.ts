import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'
import type { ToolUseContext } from '../Tool.js'

type Options = {
  name: string
  description: string
  progressMessage: string
  pluginName: string
  pluginCommand: string
  /**
   * marketplace 仍为 private 时使用的 prompt。
   * 外部用户会拿到这个 prompt；marketplace 公开后可移除该参数和 fallback 逻辑。
   */
  getPromptWhileMarketplaceIsPrivate: (
    args: string,
    context: ToolUseContext,
  ) => Promise<ContentBlockParam[]>
}

export function createMovedToPluginCommand({
  name,
  description,
  progressMessage,
  pluginName,
  pluginCommand,
  getPromptWhileMarketplaceIsPrivate,
}: Options): Command {
  return {
    type: 'prompt',
    name,
    description,
    progressMessage,
    contentLength: 0, // Dynamic content
    userFacingName() {
      return name
    },
    source: 'builtin',
    async getPromptForCommand(
      args: string,
      context: ToolUseContext,
    ): Promise<ContentBlockParam[]> {
      if (process.env.USER_TYPE === 'ant') {
        return [
          {
            type: 'text',
            text: `这个命令已经迁移到插件。请告诉用户：

1. 要安装插件，请运行：
   claude plugin install ${pluginName}@claude-code-marketplace

2. 安装后，使用 /${pluginName}:${pluginCommand} 运行该命令

3. 更多信息见：https://github.com/anthropics/claude-code-marketplace/blob/main/${pluginName}/README.md

不要尝试运行该命令。只需告知用户如何安装插件。`,
          },
        ]
      }

      return getPromptWhileMarketplaceIsPrivate(args, context)
    },
  }
}
