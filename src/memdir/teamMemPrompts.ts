import {
  buildSearchingPastContextSection,
  DIRS_EXIST_GUIDANCE,
  ENTRYPOINT_NAME,
  MAX_ENTRYPOINT_LINES,
} from './memdir.js'
import {
  MEMORY_DRIFT_CAVEAT,
  MEMORY_FRONTMATTER_EXAMPLE,
  TRUSTING_RECALL_SECTION,
  TYPES_SECTION_COMBINED,
  WHAT_NOT_TO_SAVE_SECTION,
} from './memoryTypes.js'
import { getAutoMemPath } from './paths.js'
import { getTeamMemPath } from './teamMemPaths.js'

/**
 * Build the combined prompt when both auto memory and team memory are enabled.
 * Closed four-type taxonomy (user / feedback / project / reference) with
 * per-type <scope> guidance embedded in XML-style <type> blocks.
 */
export function buildCombinedMemoryPrompt(
  extraGuidelines?: string[],
  skipIndex = false,
): string {
  const autoDir = getAutoMemPath()
  const teamDir = getTeamMemPath()

  const howToSave = skipIndex
    ? [
        '## 如何保存记忆',
        '',
        '将每条记忆写入所选目录（private 或 team，依据对应类型的 scope 指导）中的独立文件，并使用下面的 frontmatter 格式：',
        '',
        ...MEMORY_FRONTMATTER_EXAMPLE,
        '',
        '- 保持 memory 文件中的 name、description 和 type 字段与内容同步更新',
        '- 按主题语义组织记忆，而不是按时间顺序组织',
        '- 如果某条记忆后来证明错误或过时，请更新或移除它',
        '- 不要写入重复记忆。写入新记忆前，先检查是否有可更新的已有记忆。',
      ]
    : [
        '## 如何保存记忆',
        '',
        '保存记忆分两步：',
        '',
        '**步骤 1**：将记忆写入所选目录（private 或 team，依据对应类型的 scope 指导）中的独立文件，并使用下面的 frontmatter 格式：',
        '',
        ...MEMORY_FRONTMATTER_EXAMPLE,
        '',
        `**步骤 2**：在同一目录的 \`${ENTRYPOINT_NAME}\` 中添加指向该文件的指针。每个目录（private 和 team）都有自己的 \`${ENTRYPOINT_NAME}\` 索引；每个条目应为一行，约 150 字符以内：\`- [Title](file.md) - one-line hook\`。它们没有 frontmatter。绝不要把记忆内容直接写进 \`${ENTRYPOINT_NAME}\`。`,
        '',
        `- 两个 \`${ENTRYPOINT_NAME}\` 索引都会加载进你的对话上下文，${MAX_ENTRYPOINT_LINES} 行之后会被截断，因此索引要保持简洁`,
        '- 保持 memory 文件中的 name、description 和 type 字段与内容同步更新',
        '- 按主题语义组织记忆，而不是按时间顺序组织',
        '- 如果某条记忆后来证明错误或过时，请更新或移除它',
        '- 不要写入重复记忆。写入新记忆前，先检查是否有可更新的已有记忆。',
      ]

  const lines = [
    '# 记忆',
    '',
    `你有一个持久化、基于文件的记忆系统，包含两个目录：private 目录 \`${autoDir}\` 和 shared team 目录 \`${teamDir}\`。${DIRS_EXIST_GUIDANCE}`,
    '',
    '你应该随着时间逐步构建这个记忆系统，使未来对话能完整了解用户是谁、他们希望如何与你协作、哪些行为要避免或重复，以及用户交给你的工作背后的上下文。',
    '',
    '如果用户明确要求你记住某件事，请立即以最合适的类型保存。如果用户要求你忘记某件事，请找到并移除相关条目。',
    '',
    '## 记忆范围',
    '',
    '有两个 scope levels：',
    '',
    `- private：只属于你和当前用户之间的记忆。它们只在与该特定用户的对话间持久化，并存储在 root \`${autoDir}\`。`,
    `- team：由在此项目目录中工作的所有用户共享和共同贡献的记忆。Team memories 会在每个 session 开始时同步，并存储在 \`${teamDir}\`。`,
    '',
    ...TYPES_SECTION_COMBINED,
    ...WHAT_NOT_TO_SAVE_SECTION,
    '- 你必须避免在 shared team memories 中保存敏感数据。例如，绝不要保存 API keys 或 user credentials。',
    '',
    ...howToSave,
    '',
    '## 何时访问记忆',
    '- 当 personal 或 team memories 看起来相关，或用户引用他们自己或组织内其他人的过去工作时。',
    '- 当用户明确要求你 check、recall 或 remember 时，你必须访问记忆。',
    '- 如果用户说要 *ignore* 或 *not use* memory：请像 MEMORY.md 为空一样继续。不要应用、引用、对比或提及记住的事实。',
    MEMORY_DRIFT_CAVEAT,
    '',
    ...TRUSTING_RECALL_SECTION,
    '',
    '## 记忆和其他持久化形式',
    'Memory 是你在给定对话中协助用户时可用的几种持久化机制之一。区别通常在于 memory 可以在未来对话中被召回，不应用于保存只在当前对话范围内有用的信息。',
    '- 何时使用或更新 plan 而不是 memory：如果你即将开始非平凡实现任务，并希望与用户对齐方案，请使用 Plan，而不是把这些信息保存到 memory。同样，如果对话中已有 plan，而你改变了方案，请通过更新 plan 来持久化该变更，而不是保存 memory。',
    '- 何时使用或更新 tasks 而不是 memory：当你需要把当前对话中的工作拆成离散步骤，或跟踪进度时，请使用 tasks，而不是保存 memory。Tasks 很适合持久化当前对话中需要完成的工作；memory 应保留给未来对话也有用的信息。',
    ...(extraGuidelines ?? []),
    '',
    ...buildSearchingPastContextSection(autoDir),
  ]

  return lines.join('\n')
}
