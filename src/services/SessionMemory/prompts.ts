import { readFile } from 'fs/promises'
import { join } from 'path'
import { roughTokenCountEstimation } from '../../services/tokenEstimation.js'
import { getClaudeConfigHomeDir } from '../../utils/envUtils.js'
import { getErrnoCode, toError } from '../../utils/errors.js'
import { logError } from '../../utils/log.js'

const MAX_SECTION_LENGTH = 2000
const MAX_TOTAL_SESSION_MEMORY_TOKENS = 12000

export const DEFAULT_SESSION_MEMORY_TEMPLATE = `
# 会话标题
_为本会话写一个简短、有辨识度的 5-10 字描述性标题。信息密度高，不要填充词_

# 当前状态
_当前正在处理什么？尚未完成的待办任务。下一步立即要做什么。_

# 任务说明
_用户要求构建什么？有哪些设计决策或其他解释性上下文。_

# 文件和函数
_重要文件有哪些？简要说明它们包含什么以及为什么相关。_

# 工作流
_通常运行哪些 bash 命令，顺序是什么？如果输出不直观，应如何理解。_

# 错误和修正
_遇到了哪些错误以及如何修复？用户纠正了什么？哪些方法失败且不应再尝试。_

# 代码库和系统文档
_重要系统组件有哪些？它们如何工作、如何配合。_

# 经验
_哪些做法有效？哪些无效？应避免什么？不要重复其他章节已有内容。_

# 关键结果
_如果用户要求特定输出，例如问题答案、表格或其他文档，请在这里重复精确结果。_

# 工作日志
_逐步记录尝试了什么、完成了什么。每一步都要非常简洁。_
`

function getDefaultUpdatePrompt(): string {
  return `重要：这条消息和这些说明不属于真实用户对话。不要在笔记内容中提及“记笔记”“会话笔记提取”或这些更新说明。

请基于上方用户对话更新会话笔记文件。排除这条记笔记说明消息，也排除系统提示、claude.md 条目和任何过往会话总结。

文件 {{notesPath}} 已经为你读取。当前内容如下：
<current_notes_content>
{{currentNotes}}
</current_notes_content>

你的唯一任务是使用 Edit 工具更新笔记文件，然后停止。你可以进行多处编辑（按需更新每个章节），请在一条消息中并行发出所有 Edit 工具调用。不要调用任何其他工具。

编辑关键规则：
- 文件必须保持完全相同的结构，保留所有章节、标题和斜体描述
-- 绝不要修改、删除或新增章节标题（以 '#' 开头的行，例如 # 任务说明）
-- 绝不要修改或删除斜体 _章节描述_ 行（每个标题后紧跟的斜体行，以 underscores 开始和结束）
-- 斜体 _章节描述_ 是模板说明，必须原样保留；它们说明每个章节应包含什么内容
-- 只更新每个现有章节中斜体 _章节描述_ 下方的实际内容
-- 不要在现有结构之外添加任何新章节、总结或信息
- 不要在笔记任何位置提及这个记笔记过程或这些说明
- 如果某章节没有实质性新见解，可以跳过更新。不要添加“暂无信息”之类填充内容；适合留空/不编辑时就保持空白。
- 每个章节都要写详细、信息密集的内容，包括文件路径、函数名、错误消息、精确命令、技术细节等。
- 对于“关键结果”，包含用户要求的完整精确输出（例如完整表格、完整答案等）。
- 不要包含上下文中 CLAUDE.md 文件里已经存在的信息。
- 每个章节保持在约 ${MAX_SECTION_LENGTH} tokens/words 以内；如果章节接近限制，请删减较不重要的细节，同时保留最关键的信息。
- 聚焦可操作、具体的信息，帮助后来的人理解或复现对话中讨论的工作。
- 重要：始终更新“当前状态”，反映最近的工作；这对压缩后的连续性非常关键。

使用 Edit 工具，file_path 为：{{notesPath}}

结构保留提醒：
每个章节有两个部分必须按当前文件中的样子原样保留：
1. 章节标题（以 # 开头的行）
2. 斜体描述行（标题后紧跟的 _斜体文本_，这是模板说明）

你只更新这两行之后的实际内容。以下划线开头和结尾的斜体描述行属于模板结构，不是要编辑或删除的内容。

记住：并行使用 Edit 工具，然后停止。编辑完成后不要继续。只包含真实用户对话中的见解，绝不要包含这些记笔记说明中的内容。不要删除或更改章节标题或斜体 _章节描述_。`
}

/**
 * Load custom session memory template from file if it exists
 */
export async function loadSessionMemoryTemplate(): Promise<string> {
  const templatePath = join(
    getClaudeConfigHomeDir(),
    'session-memory',
    'config',
    'template.md',
  )

  try {
    return await readFile(templatePath, { encoding: 'utf-8' })
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') {
      return DEFAULT_SESSION_MEMORY_TEMPLATE
    }
    logError(toError(e))
    return DEFAULT_SESSION_MEMORY_TEMPLATE
  }
}

/**
 * Load custom session memory prompt from file if it exists
 * Custom prompts can be placed at ~/.claude/session-memory/prompt.md
 * Use {{variableName}} syntax for variable substitution (e.g., {{currentNotes}}, {{notesPath}})
 */
export async function loadSessionMemoryPrompt(): Promise<string> {
  const promptPath = join(
    getClaudeConfigHomeDir(),
    'session-memory',
    'config',
    'prompt.md',
  )

  try {
    return await readFile(promptPath, { encoding: 'utf-8' })
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    if (code === 'ENOENT') {
      return getDefaultUpdatePrompt()
    }
    logError(toError(e))
    return getDefaultUpdatePrompt()
  }
}

/**
 * Parse the session memory file and analyze section sizes
 */
function analyzeSectionSizes(content: string): Record<string, number> {
  const sections: Record<string, number> = {}
  const lines = content.split('\n')
  let currentSection = ''
  let currentContent: string[] = []

  for (const line of lines) {
    if (line.startsWith('# ')) {
      if (currentSection && currentContent.length > 0) {
        const sectionContent = currentContent.join('\n').trim()
        sections[currentSection] = roughTokenCountEstimation(sectionContent)
      }
      currentSection = line
      currentContent = []
    } else {
      currentContent.push(line)
    }
  }

  if (currentSection && currentContent.length > 0) {
    const sectionContent = currentContent.join('\n').trim()
    sections[currentSection] = roughTokenCountEstimation(sectionContent)
  }

  return sections
}

/**
 * Generate reminders for sections that are too long
 */
function generateSectionReminders(
  sectionSizes: Record<string, number>,
  totalTokens: number,
): string {
  const overBudget = totalTokens > MAX_TOTAL_SESSION_MEMORY_TOKENS
  const oversizedSections = Object.entries(sectionSizes)
    .filter(([_, tokens]) => tokens > MAX_SECTION_LENGTH)
    .sort(([, a], [, b]) => b - a)
    .map(
      ([section, tokens]) =>
        `- "${section}" is ~${tokens} tokens (limit: ${MAX_SECTION_LENGTH})`,
    )

  if (oversizedSections.length === 0 && !overBudget) {
    return ''
  }

  const parts: string[] = []

  if (overBudget) {
    parts.push(
      `\n\n严重：会话记忆文件当前约 ${totalTokens} tokens，超过最大限制 ${MAX_TOTAL_SESSION_MEMORY_TOKENS} tokens。你必须压缩文件以适配预算。请主动缩短过大的章节：移除较不重要的细节、合并相关条目、总结较早记录。优先保证“当前状态”和“错误和修正”准确且详细。`,
    )
  }

  if (oversizedSections.length > 0) {
    parts.push(
      `\n\n${overBudget ? '需要压缩的过大章节' : '重要：以下章节超过单章节限制，必须压缩'}：\n${oversizedSections.join('\n')}`,
    )
  }

  return parts.join('')
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
 * Check if the session memory content is essentially empty (matches the template).
 * This is used to detect if no actual content has been extracted yet,
 * which means we should fall back to legacy compact behavior.
 */
export async function isSessionMemoryEmpty(content: string): Promise<boolean> {
  const template = await loadSessionMemoryTemplate()
  // Compare trimmed content to detect if it's just the template
  return content.trim() === template.trim()
}

export async function buildSessionMemoryUpdatePrompt(
  currentNotes: string,
  notesPath: string,
): Promise<string> {
  const promptTemplate = await loadSessionMemoryPrompt()

  // Analyze section sizes and generate reminders if needed
  const sectionSizes = analyzeSectionSizes(currentNotes)
  const totalTokens = roughTokenCountEstimation(currentNotes)
  const sectionReminders = generateSectionReminders(sectionSizes, totalTokens)

  // Substitute variables in the prompt
  const variables = {
    currentNotes,
    notesPath,
  }

  const basePrompt = substituteVariables(promptTemplate, variables)

  // Add section size reminders and/or total budget warnings
  return basePrompt + sectionReminders
}

/**
 * Truncate session memory sections that exceed the per-section token limit.
 * Used when inserting session memory into compact messages to prevent
 * oversized session memory from consuming the entire post-compact token budget.
 *
 * Returns the truncated content and whether any truncation occurred.
 */
export function truncateSessionMemoryForCompact(content: string): {
  truncatedContent: string
  wasTruncated: boolean
} {
  const lines = content.split('\n')
  const maxCharsPerSection = MAX_SECTION_LENGTH * 4 // roughTokenCountEstimation uses length/4
  const outputLines: string[] = []
  let currentSectionLines: string[] = []
  let currentSectionHeader = ''
  let wasTruncated = false

  for (const line of lines) {
    if (line.startsWith('# ')) {
      const result = flushSessionSection(
        currentSectionHeader,
        currentSectionLines,
        maxCharsPerSection,
      )
      outputLines.push(...result.lines)
      wasTruncated = wasTruncated || result.wasTruncated
      currentSectionHeader = line
      currentSectionLines = []
    } else {
      currentSectionLines.push(line)
    }
  }

  // Flush the last section
  const result = flushSessionSection(
    currentSectionHeader,
    currentSectionLines,
    maxCharsPerSection,
  )
  outputLines.push(...result.lines)
  wasTruncated = wasTruncated || result.wasTruncated

  return {
    truncatedContent: outputLines.join('\n'),
    wasTruncated,
  }
}

function flushSessionSection(
  sectionHeader: string,
  sectionLines: string[],
  maxCharsPerSection: number,
): { lines: string[]; wasTruncated: boolean } {
  if (!sectionHeader) {
    return { lines: sectionLines, wasTruncated: false }
  }

  const sectionContent = sectionLines.join('\n')
  if (sectionContent.length <= maxCharsPerSection) {
    return { lines: [sectionHeader, ...sectionLines], wasTruncated: false }
  }

  // Truncate at a line boundary near the limit
  let charCount = 0
  const keptLines: string[] = [sectionHeader]
  for (const line of sectionLines) {
    if (charCount + line.length + 1 > maxCharsPerSection) {
      break
    }
    keptLines.push(line)
    charCount += line.length + 1
  }
  keptLines.push('\n[... section truncated for length ...]')
  return { lines: keptLines, wasTruncated: true }
}
