/**
 * 后台记忆提取 agent 的提示词模板。
 *
 * 提取 agent 会作为主会话的完美分叉运行：相同的系统提示词和消息前缀。
 * 主 agent 的系统提示词始终包含完整的保存说明；当主 agent 自己写入记忆时，
 * extractMemories.ts 会跳过该轮（hasMemoryWritesSince）。本提示词只会在主
 * agent 没有写入时触发，因此这里的保存标准与系统提示词重叠是无害的。
 */

import { feature } from 'bun:bundle'
import {
  MEMORY_FRONTMATTER_EXAMPLE,
  TYPES_SECTION_COMBINED,
  TYPES_SECTION_INDIVIDUAL,
  WHAT_NOT_TO_SAVE_SECTION,
} from '../../memdir/memoryTypes.js'
import { BASH_TOOL_NAME } from '../../tools/BashTool/toolName.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../../tools/FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../../tools/GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../../tools/GrepTool/prompt.js'

/**
 * 两种提取提示词共享的开头。
 */
function opener(newMessageCount: number, existingMemories: string): string {
  const manifest =
    existingMemories.length > 0
      ? `\n\n## 已有记忆文件\n\n${existingMemories}\n\n写入前先检查这个列表，优先更新已有文件，避免创建重复记忆。`
      : ''
  return [
    `你现在作为记忆提取子 agent 行动。分析上方最近约 ${newMessageCount} 条消息，并用它们更新你的持久记忆系统。`,
    '',
    `可用工具：${FILE_READ_TOOL_NAME}、${GREP_TOOL_NAME}、${GLOB_TOOL_NAME}、只读 ${BASH_TOOL_NAME}（ls/find/cat/stat/wc/head/tail 及类似命令），以及仅限记忆目录内路径使用的 ${FILE_EDIT_TOOL_NAME}/${FILE_WRITE_TOOL_NAME}。不允许使用 ${BASH_TOOL_NAME} rm。所有其他工具，例如 MCP、Agent、可写 ${BASH_TOOL_NAME} 等，都会被拒绝。`,
    '',
    `你的轮次数量有限。${FILE_EDIT_TOOL_NAME} 要求先对同一文件调用 ${FILE_READ_TOOL_NAME}，因此高效策略是：第 1 轮并行发出所有可能要更新文件的 ${FILE_READ_TOOL_NAME} 调用；第 2 轮并行发出所有 ${FILE_WRITE_TOOL_NAME}/${FILE_EDIT_TOOL_NAME} 调用。不要在多轮之间交错读取和写入。`,
    '',
    `你只能使用最近约 ${newMessageCount} 条消息中的内容来更新持久记忆。不要浪费轮次进一步调查或验证这些内容，不要 grep 源文件，不要读取代码来确认某个模式是否存在，也不要运行 git 命令。` +
      manifest,
  ].join('\n')
}

/**
 * 构建仅自动记忆（无团队记忆）的提取提示词。
 * 四类分类法，无范围指导（单目录）。
 */
export function buildExtractAutoOnlyPrompt(
  newMessageCount: number,
  existingMemories: string,
  skipIndex = false,
): string {
  const howToSave = skipIndex
    ? [
        '## 如何保存记忆',
        '',
        '将每条记忆写入自己的文件（例如 `user_role.md`、`feedback_testing.md`），并使用下面的 frontmatter 格式：',
        '',
        ...MEMORY_FRONTMATTER_EXAMPLE,
        '',
        '- 按主题语义组织记忆，而不是按时间顺序组织',
        '- 如果某条记忆后来证明错误或过时，请更新或移除它',
        '- 不要写入重复记忆。写入新记忆前，先检查是否有可更新的已有记忆。',
      ]
    : [
        '## 如何保存记忆',
        '',
        '保存记忆分两步：',
        '',
        '**步骤 1**：将记忆写入自己的文件（例如 `user_role.md`、`feedback_testing.md`），并使用下面的 frontmatter 格式：',
        '',
        ...MEMORY_FRONTMATTER_EXAMPLE,
        '',
        '**步骤 2**：在 `MEMORY.md` 中添加指向该文件的指针。`MEMORY.md` 是索引，不是记忆本体；每个条目应为一行，长度约 150 字符以内：`- [Title](file.md) - one-line hook`。它没有 frontmatter。不要把记忆内容直接写进 `MEMORY.md`。',
        '',
        '- `MEMORY.md` 总是会加载进你的系统提示词，200 行之后会被截断，因此索引要保持简洁',
        '- 按主题语义组织记忆，而不是按时间顺序组织',
        '- 如果某条记忆后来证明错误或过时，请更新或移除它',
        '- 不要写入重复记忆。写入新记忆前，先检查是否有可更新的已有记忆。',
      ]

  return [
    opener(newMessageCount, existingMemories),
    '',
    '如果用户明确要求你记住某件事，请立即以最合适的类型保存。如果用户要求你忘记某件事，请找到并移除相关条目。',
    '',
    ...TYPES_SECTION_INDIVIDUAL,
    ...WHAT_NOT_TO_SAVE_SECTION,
    '',
    ...howToSave,
  ].join('\n')
}

/**
 * 构建自动记忆 + 团队记忆组合模式的提取提示词。
 * 四类分类法，并在每类中包含 <scope> 指导（目录选择已写入各类型块，
 * 不需要单独的路由章节）。
 */
export function buildExtractCombinedPrompt(
  newMessageCount: number,
  existingMemories: string,
  skipIndex = false,
): string {
  if (!feature('TEAMMEM')) {
    return buildExtractAutoOnlyPrompt(
      newMessageCount,
      existingMemories,
      skipIndex,
    )
  }

  const howToSave = skipIndex
    ? [
        '## 如何保存记忆',
        '',
        '将每条记忆写入所选目录（private 或 team，依据对应类型的范围指导）中的独立文件，并使用下面的 frontmatter 格式：',
        '',
        ...MEMORY_FRONTMATTER_EXAMPLE,
        '',
        '- 按主题语义组织记忆，而不是按时间顺序组织',
        '- 如果某条记忆后来证明错误或过时，请更新或移除它',
        '- 不要写入重复记忆。写入新记忆前，先检查是否有可更新的已有记忆。',
      ]
    : [
        '## 如何保存记忆',
        '',
        '保存记忆分两步：',
        '',
        '**步骤 1**：将记忆写入所选目录（private 或 team，依据对应类型的范围指导）中的独立文件，并使用下面的 frontmatter 格式：',
        '',
        ...MEMORY_FRONTMATTER_EXAMPLE,
        '',
        "**步骤 2**：在同一目录的 `MEMORY.md` 中添加指向该文件的指针。每个目录（private 和 team）都有自己的 `MEMORY.md` 索引；每个条目应为一行，长度约 150 字符以内：`- [Title](file.md) - one-line hook`。它们没有 frontmatter。不要把记忆内容直接写进 `MEMORY.md`。",
        '',
        '- 两个 `MEMORY.md` 索引都会加载进你的系统提示词，200 行之后会被截断，因此索引要保持简洁',
        '- 按主题语义组织记忆，而不是按时间顺序组织',
        '- 如果某条记忆后来证明错误或过时，请更新或移除它',
        '- 不要写入重复记忆。写入新记忆前，先检查是否有可更新的已有记忆。',
      ]

  return [
    opener(newMessageCount, existingMemories),
    '',
    '如果用户明确要求你记住某件事，请立即以最合适的类型保存。如果用户要求你忘记某件事，请找到并移除相关条目。',
    '',
    ...TYPES_SECTION_COMBINED,
    ...WHAT_NOT_TO_SAVE_SECTION,
    '- 你必须避免在共享团队记忆中保存敏感数据。例如，绝不要保存 API key 或用户凭据。',
    '',
    ...howToSave,
  ].join('\n')
}
