import { feature } from 'bun:bundle'
import type { PartialCompactDirection } from '../../types/message.js'

// Dead code elimination: conditional import for proactive mode
/* eslint-disable @typescript-eslint/no-require-imports */
const proactiveModule =
  feature('PROACTIVE') || feature('KAIROS')
    ? (require('../../proactive/index.js') as typeof import('../../proactive/index.js'))
    : null
/* eslint-enable @typescript-eslint/no-require-imports */

// Aggressive no-tools preamble. The cache-sharing fork path inherits the
// parent's full tool set (required for cache-key match), and on Sonnet 4.6+
// adaptive-thinking models the model sometimes attempts a tool call despite
// the weaker trailer instruction. With maxTurns: 1, a denied tool call means
// no text output → falls through to the streaming fallback (2.79% on 4.6 vs
// 0.01% on 4.5). Putting this FIRST and making it explicit about rejection
// consequences prevents the wasted turn.
const NO_TOOLS_PREAMBLE = `严重：只能用文本回复。不要调用任何工具。

- 不要使用 Read、Bash、Grep、Glob、Edit、Write 或任何其他工具。
- 你已经在上方对话中拥有所需的全部上下文。
- 工具调用会被拒绝，并浪费你唯一的回合；这样会导致任务失败。
- 你的完整回复必须是纯文本：先输出一个 <analysis> 块，再输出一个 <summary> 块。

`

// Two variants: BASE scopes to "the conversation", PARTIAL scopes to "the
// recent messages". The <analysis> block is a drafting scratchpad that
// formatCompactSummary() strips before the summary reaches context.
const DETAILED_ANALYSIS_INSTRUCTION_BASE = `在给出最终总结前，请用 <analysis> 标签包裹你的分析，以组织思路并确保覆盖所有必要要点。分析过程中：

1. 按时间顺序分析对话中的每条消息和每个部分。对每个部分都要充分识别：
   - 用户的明确请求和意图
   - 你处理用户请求的方法
   - 关键决策、技术概念和代码模式
   - 具体细节，例如：
     - 文件名
     - 完整代码片段
     - 函数签名
     - 文件编辑
   - 你遇到的错误以及如何修复
   - 特别注意你收到的具体用户反馈，尤其是用户要求你改用不同做法时。
2. 复查技术准确性和完整性，充分覆盖每个必需元素。`

const DETAILED_ANALYSIS_INSTRUCTION_PARTIAL = `在给出最终总结前，请用 <analysis> 标签包裹你的分析，以组织思路并确保覆盖所有必要要点。分析过程中：

1. 按时间顺序分析最近消息。对每个部分都要充分识别：
   - 用户的明确请求和意图
   - 你处理用户请求的方法
   - 关键决策、技术概念和代码模式
   - 具体细节，例如：
     - 文件名
     - 完整代码片段
     - 函数签名
     - 文件编辑
   - 你遇到的错误以及如何修复
   - 特别注意你收到的具体用户反馈，尤其是用户要求你改用不同做法时。
2. 复查技术准确性和完整性，充分覆盖每个必需元素。`

const BASE_COMPACT_PROMPT = `你的任务是为目前为止的对话创建详细总结，特别关注用户的明确请求以及你此前采取的行动。
总结应充分捕获技术细节、代码模式和架构决策，这些信息对在不丢失上下文的情况下继续开发工作至关重要。

${DETAILED_ANALYSIS_INSTRUCTION_BASE}

你的总结应包含以下章节：

1. 主要请求和意图：详细捕获用户的所有明确请求和意图
2. 关键技术概念：列出讨论过的所有重要技术概念、技术和框架。
3. 文件和代码片段：列出检查、修改或创建过的具体文件和代码片段。特别注意最近消息；适用时包含完整代码片段，并总结为什么该文件读取或编辑重要。
4. 错误和修复：列出遇到的所有错误以及如何修复。特别注意收到的具体用户反馈，尤其是用户要求你改用不同做法时。
5. 问题解决：记录已解决的问题以及仍在进行的排障工作。
6. 所有用户消息：列出所有非工具结果的用户消息。这些对理解用户反馈和意图变化至关重要。
7. 待办任务：概述用户明确要求你处理但尚未完成的任务。
8. 当前工作：详细描述这次总结请求前正在处理的具体工作，特别关注用户和助手最近消息。适用时包含文件名和代码片段。
9. 可选下一步：列出与你最近工作直接相关的下一步。重要：确保这一步直接符合用户最近的明确请求，以及总结请求前你正在处理的任务。如果上一项任务已经结束，只有在下一步明确符合用户请求时才列出。不要在未先向用户确认的情况下开始无关请求或很久以前已完成的旧请求。
                       如果有下一步，请包含最近对话的直接引用，精确显示你正在处理什么任务以及停在哪里。引用应逐字保留，避免任务理解漂移。

下面是输出结构示例：

<example>
<analysis>
[你的思考过程，确保所有要点都被充分且准确覆盖]
</analysis>

<summary>
1. 主要请求和意图：
   [详细描述]

2. 关键技术概念：
   - [概念 1]
   - [概念 2]
   - [...]

3. 文件和代码片段：
   - [文件名 1]
      - [为什么此文件重要的总结]
      - [对此文件所做更改的总结，如有]
      - [重要代码片段]
   - [文件名 2]
      - [重要代码片段]
   - [...]

4. 错误和修复：
    - [错误 1 的详细描述]：
      - [你如何修复该错误]
      - [如有，用户对该错误的反馈]
    - [...]

5. 问题解决：
   [已解决问题和仍在进行的排障描述]

6. 所有用户消息：
    - [详细的非工具结果用户消息]
    - [...]

7. 待办任务：
   - [任务 1]
   - [任务 2]
   - [...]

8. 当前工作：
   [当前工作的精确描述]

9. 可选下一步：
   [可选的下一步行动]

</summary>
</example>

请基于目前为止的对话提供总结，遵循此结构，并确保回复精确、详尽。

包含的上下文中可能还有额外总结说明。如果有，请在创建上述总结时遵循这些说明。说明示例：
<example>
## 压缩说明
总结对话时，请关注 typescript 代码变更，并记住你犯过的错误以及如何修复它们。
</example>

<example>
# 总结说明
使用 compact 时，请重点关注测试输出和代码变更。逐字包含文件读取内容。
</example>
`

const PARTIAL_COMPACT_PROMPT = `你的任务是为对话的最近部分创建详细总结，也就是早期保留上下文之后的消息。早期消息会被完整保留，不需要总结。总结只聚焦最近消息中讨论、学到和完成的内容。

${DETAILED_ANALYSIS_INSTRUCTION_PARTIAL}

你的总结应包含以下章节：

1. 主要请求和意图：捕获最近消息中用户的明确请求和意图
2. 关键技术概念：列出最近讨论的重要技术概念、技术和框架。
3. 文件和代码片段：列出检查、修改或创建过的具体文件和代码片段。适用时包含完整代码片段，并总结为什么该文件读取或编辑重要。
4. 错误和修复：列出遇到的错误以及如何修复。
5. 问题解决：记录已解决的问题以及仍在进行的排障工作。
6. 所有用户消息：列出最近部分中所有非工具结果的用户消息。
7. 待办任务：概述最近消息中的任何待办任务。
8. 当前工作：精确描述此总结请求前正在处理的工作。
9. 可选下一步：列出与最近工作相关的下一步。包含最近对话的直接引用。

下面是输出结构示例：

<example>
<analysis>
[你的思考过程，确保所有要点都被充分且准确覆盖]
</analysis>

<summary>
1. 主要请求和意图：
   [详细描述]

2. 关键技术概念：
   - [概念 1]
   - [概念 2]

3. 文件和代码片段：
   - [文件名 1]
      - [为什么此文件重要的总结]
      - [重要代码片段]

4. 错误和修复：
    - [错误描述]：
      - [你如何修复它]

5. 问题解决：
   [描述]

6. 所有用户消息：
    - [详细的非工具结果用户消息]

7. 待办任务：
   - [任务 1]

8. 当前工作：
   [当前工作的精确描述]

9. 可选下一步：
   [可选的下一步行动]

</summary>
</example>

请只基于最近消息（保留的早期上下文之后的内容）提供总结，遵循此结构，并确保回复精确、详尽。
`

// 'up_to': model sees only the summarized prefix (cache hit). Summary will
// precede kept recent messages, hence "Context for Continuing Work" section.
const PARTIAL_COMPACT_UP_TO_PROMPT = `你的任务是为这段对话创建详细总结。此总结会放在后续会话的开头；在你的总结之后会接上基于此上下文的新消息（你在这里看不到它们）。请充分总结，让只阅读你的总结和后续新消息的人也能完整理解发生了什么并继续工作。

${DETAILED_ANALYSIS_INSTRUCTION_BASE}

你的总结应包含以下章节：

1. 主要请求和意图：详细捕获用户的明确请求和意图
2. 关键技术概念：列出讨论过的重要技术概念、技术和框架。
3. 文件和代码片段：列出检查、修改或创建过的具体文件和代码片段。适用时包含完整代码片段，并总结为什么该文件读取或编辑重要。
4. 错误和修复：列出遇到的错误以及如何修复。
5. 问题解决：记录已解决的问题以及仍在进行的排障工作。
6. 所有用户消息：列出所有非工具结果的用户消息。
7. 待办任务：概述任何待办任务。
8. 已完成工作：描述此部分结束时已完成的内容。
9. 继续工作的上下文：总结后续消息中理解和继续工作所需的上下文、决策或状态。

下面是输出结构示例：

<example>
<analysis>
[你的思考过程，确保所有要点都被充分且准确覆盖]
</analysis>

<summary>
1. 主要请求和意图：
   [详细描述]

2. 关键技术概念：
   - [概念 1]
   - [概念 2]

3. 文件和代码片段：
   - [文件名 1]
      - [为什么此文件重要的总结]
      - [重要代码片段]

4. 错误和修复：
    - [错误描述]：
      - [你如何修复它]

5. 问题解决：
   [描述]

6. 所有用户消息：
    - [详细的非工具结果用户消息]

7. 待办任务：
   - [任务 1]

8. 已完成工作：
   [已完成内容的描述]

9. 继续工作的上下文：
   [继续工作所需的关键上下文、决策或状态]

</summary>
</example>

请按照此结构提供总结，并确保回复精确、详尽。
`

const NO_TOOLS_TRAILER =
  '\n\n提醒：不要调用任何工具。只能用纯文本回复，' +
  '先输出一个 <analysis> 块，再输出一个 <summary> 块。' +
  '工具调用会被拒绝，并导致任务失败。'

export function getPartialCompactPrompt(
  customInstructions?: string,
  direction: PartialCompactDirection = 'from',
): string {
  const template =
    direction === 'up_to'
      ? PARTIAL_COMPACT_UP_TO_PROMPT
      : PARTIAL_COMPACT_PROMPT
  let prompt = NO_TOOLS_PREAMBLE + template

  if (customInstructions && customInstructions.trim() !== '') {
    prompt += `\n\n额外说明：\n${customInstructions}`
  }

  prompt += NO_TOOLS_TRAILER

  return prompt
}

export function getCompactPrompt(customInstructions?: string): string {
  let prompt = NO_TOOLS_PREAMBLE + BASE_COMPACT_PROMPT

  if (customInstructions && customInstructions.trim() !== '') {
    prompt += `\n\n额外说明：\n${customInstructions}`
  }

  prompt += NO_TOOLS_TRAILER

  return prompt
}

/**
 * Formats the compact summary by stripping the <analysis> drafting scratchpad
 * and replacing <summary> XML tags with readable section headers.
 * @param summary The raw summary string potentially containing <analysis> and <summary> XML tags
 * @returns The formatted summary with analysis stripped and summary tags replaced by headers
 */
export function formatCompactSummary(summary: string): string {
  let formattedSummary = summary

  // Strip analysis section — it's a drafting scratchpad that improves summary
  // quality but has no informational value once the summary is written.
  formattedSummary = formattedSummary.replace(
    /<analysis>[\s\S]*?<\/analysis>/,
    '',
  )

  // Extract and format summary section
  const summaryMatch = formattedSummary.match(/<summary>([\s\S]*?)<\/summary>/)
  if (summaryMatch) {
    const content = summaryMatch[1] || ''
    formattedSummary = formattedSummary.replace(
      /<summary>[\s\S]*?<\/summary>/,
      `总结：\n${content.trim()}`,
    )
  }

  // Clean up extra whitespace between sections
  formattedSummary = formattedSummary.replace(/\n\n+/g, '\n\n')

  return formattedSummary.trim()
}

export function getCompactUserSummaryMessage(
  summary: string,
  suppressFollowUpQuestions?: boolean,
  transcriptPath?: string,
  recentMessagesPreserved?: boolean,
): string {
  const formattedSummary = formatCompactSummary(summary)

  let baseSummary = `此会话正在从一个耗尽上下文的先前对话继续。下面的总结覆盖对话中较早的部分。

${formattedSummary}`

  if (transcriptPath) {
    baseSummary += `\n\n如果你需要压缩前的具体细节（例如精确代码片段、错误消息或你生成的内容），请读取完整转录：${transcriptPath}`
  }

  if (recentMessagesPreserved) {
    baseSummary += `\n\n最近消息已逐字保留。`
  }

  if (suppressFollowUpQuestions) {
    let continuation = `${baseSummary}
从中断处继续对话，不要再向用户提问。直接恢复：不要确认总结，不要复述刚才发生了什么，不要用“我会继续”或类似开场。像中断从未发生一样接着最后的任务做。`

    if (
      (feature('PROACTIVE') || feature('KAIROS')) &&
      proactiveModule?.isProactiveActive()
    ) {
      continuation += `

你正在自主/主动模式下运行。这不是第一次唤醒；压缩前你已经在自主工作。请继续你的工作循环：基于上方总结从中断处接着做。不要问候用户，也不要询问要做什么。`
    }

    return continuation
  }

  return baseSummary
}
