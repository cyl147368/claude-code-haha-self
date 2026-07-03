import { isCompactLinePrefixEnabled } from '../../utils/file.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

function getPreReadInstruction(): string {
  return `\n- 编辑前，你必须在本轮对话中至少使用一次 \`${FILE_READ_TOOL_NAME}\` 工具读取该文件。如果未读取文件就尝试编辑，此工具会报错。`
}

export function getEditToolDescription(): string {
  return getDefaultEditDescription()
}

function getDefaultEditDescription(): string {
  const prefixFormat = isCompactLinePrefixEnabled()
    ? 'line number + tab'
    : 'spaces + line number + arrow'
  const minimalUniquenessHint =
    process.env.USER_TYPE === 'ant'
      ? `\n- 使用能明确唯一定位目标的最小 old_string；通常 2-4 行相邻内容就足够。不要在较少内容已经足够唯一时包含 10 行以上上下文。`
      : ''
  return `在文件中执行精确字符串替换。

用法：${getPreReadInstruction()}
- 编辑来自 Read 工具输出的文本时，必须保留行号前缀之后实际内容的精确缩进（tab/空格）。行号前缀格式为：${prefixFormat}。前缀之后才是需要匹配的真实文件内容。不要在 old_string 或 new_string 中包含行号前缀的任何部分。
- 始终优先编辑代码库中的现有文件。除非明确需要，否则不要写入新文件。
- 只有当用户明确要求时才使用 emoji。除非用户要求，否则不要向文件中添加 emoji。
- 如果 \`old_string\` 在文件中不唯一，编辑会失败。请提供包含更多周边上下文的更大字符串以确保唯一，或使用 \`replace_all\` 修改每一个 \`old_string\` 实例。${minimalUniquenessHint}
- 使用 \`replace_all\` 在整个文件中替换和重命名字符串。例如需要重命名变量时，此参数很有用。`
}
