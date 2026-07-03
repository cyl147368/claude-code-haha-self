import { join } from 'path'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getFsImplementation } from '../../utils/fsOperations.js'

/**
 * Get the Magic Docs update prompt template
 */
function getUpdatePromptTemplate(): string {
  return `重要：这条消息和这些说明不属于真实用户对话。不要在文档内容中提及“文档更新”“magic docs”或这些更新说明。

请基于上方用户对话更新 Magic Doc 文件，纳入任何值得保留的新学习、新见解或新信息。排除这条文档更新说明消息。

文件 {{docPath}} 已经为你读取。当前内容如下：
<current_doc_content>
{{docContents}}
</current_doc_content>

文档标题：{{docTitle}}
{{customInstructions}}

你的唯一任务是：如果有实质性新信息需要添加，就使用 Edit 工具更新文档文件，然后停止。你可以进行多处编辑（按需更新多个章节），请在一条消息中并行发出所有 Edit 工具调用。如果没有实质性内容可加，只需简短说明，不要调用任何工具。

编辑关键规则：
- 原样保留 Magic Doc 标题：# MAGIC DOC: {{docTitle}}
- 如果标题后紧跟斜体行，也必须原样保留
- 让文档保持代码库最新状态；这不是 changelog 或历史记录
- 在原位置更新信息以反映当前状态；不要追加历史备注或跟踪随时间变化的记录
- 删除或替换过时信息，不要添加“Previously...”或“Updated to...”之类说明
- 清理或删除不再相关、或不符合文档目的的章节
- 修正明显错误：拼写、语法、破损格式、错误信息或令人困惑的表述
- 保持文档组织良好：标题清晰、章节顺序合理、格式一致、层级正确

文档理念 - 仔细阅读：
- 保持简洁。只保留高信号内容。不要填充词或不必要展开。
- 文档用于概览、架构和入口点，不用于详细代码导览。
- 不要重复从源码可直接看出的信息。
- 不要记录每个函数、参数或行号引用。
- 聚焦：为什么存在、组件如何连接、从哪里开始阅读、使用了什么模式。
- 跳过：详细实现步骤、穷尽式 API 文档、流水账叙述。

应该记录什么：
- 高层架构和系统设计
- 不明显的模式、约定或坑点
- 关键入口点，以及从哪里开始读代码
- 重要设计决策及其理由
- 关键依赖或集成点
- 相关文件、文档或代码引用（像 wiki 一样），帮助读者跳到相关上下文

不应记录什么：
- 读源码本身就很明显的内容
- 文件、函数或参数的穷尽列表
- 逐步实现细节
- 底层代码机械过程
- CLAUDE.md 或其他项目文档中已经存在的信息

使用 Edit 工具，file_path 为：{{docPath}}

记住：只有在有实质性新信息时才更新。Magic Doc 标题（# MAGIC DOC: {{docTitle}}）必须保持不变。`
}

/**
 * Load custom Magic Docs prompt from file if it exists
 * Custom prompts can be placed at ~/.claude/magic-docs/prompt.md
 * Use {{variableName}} syntax for variable substitution (e.g., {{docContents}}, {{docPath}}, {{docTitle}})
 */
async function loadMagicDocsPrompt(): Promise<string> {
  const fs = getFsImplementation()
  const promptPath = join(getClaudeConfigHomeDir(), 'magic-docs', 'prompt.md')

  try {
    return await fs.readFile(promptPath, { encoding: 'utf-8' })
  } catch {
    // Silently fall back to default if custom prompt doesn't exist or fails to load
    return getUpdatePromptTemplate()
  }
}

/**
 * Substitute variables in the prompt template using {{variable}} syntax
 */
function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  // Single-pass replacement avoids two bugs: (1) $ backreference corruption
  // (replacer fn treats $ literally), and (2) double-substitution when user
  // content happens to contain {{varName}} matching a later variable.
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]!
      : match,
  )
}

/**
 * Build the Magic Docs update prompt with variable substitution
 */
export async function buildMagicDocsUpdatePrompt(
  docContents: string,
  docPath: string,
  docTitle: string,
  instructions?: string,
): Promise<string> {
  const promptTemplate = await loadMagicDocsPrompt()

  // Build custom instructions section if provided
  const customInstructions = instructions
    ? `

文档专用更新说明：
文档作者提供了关于如何更新此文件的具体说明。请特别注意并严格遵循：

"${instructions}"

这些说明优先于下方通用规则。确保你的更新符合这些具体准则。`
    : ''

  // Substitute variables in the prompt
  const variables = {
    docContents,
    docPath,
    docTitle,
    customInstructions,
  }

  return substituteVariables(promptTemplate, variables)
}
