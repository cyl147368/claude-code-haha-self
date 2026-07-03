import { isPDFSupported } from '../../utils/pdfUtils.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

// Use a string constant for tool names to avoid circular dependencies
export const FILE_READ_TOOL_NAME = 'Read'

export const FILE_UNCHANGED_STUB =
  '文件自上次读取后没有变化。本轮对话中较早的 Read 工具结果仍然有效，请引用之前的内容，不要重复读取。'

export const MAX_LINES_TO_READ = 2000

export const DESCRIPTION = '从本地文件系统读取文件。'

export const LINE_FORMAT_INSTRUCTION =
  '- 结果使用 cat -n 格式返回，行号从 1 开始'

export const OFFSET_INSTRUCTION_DEFAULT =
  '- 你可以选择指定行偏移和行数限制（对长文件尤其有用），但默认建议不提供这些参数以读取完整文件'

export const OFFSET_INSTRUCTION_TARGETED =
  '- 当你已经知道需要文件的哪一部分时，只读取那一部分。对于大文件这很重要。'

/**
 * Renders the Read tool prompt template.  The caller (FileReadTool) supplies
 * the runtime-computed parts.
 */
export function renderPromptTemplate(
  lineFormat: string,
  maxSizeInstruction: string,
  offsetInstruction: string,
): string {
  return `从本地文件系统读取文件。你可以使用此工具直接访问任何文件。
假设此工具能够读取机器上的所有文件。如果用户提供了文件路径，请假设该路径有效。读取不存在的文件也是允许的；工具会返回错误。

用法：
- file_path 参数必须是绝对路径，不能是相对路径
- 默认从文件开头最多读取 ${MAX_LINES_TO_READ} 行${maxSizeInstruction}
${offsetInstruction}
${lineFormat}
- 此工具允许 Claude Code 读取图片（例如 PNG、JPG 等）。读取图片文件时，内容会以视觉形式呈现，因为 Claude Code 是多模态 LLM。${
    isPDFSupported()
      ? '\n- 此工具可以读取 PDF 文件（.pdf）。对于超过 10 页的大型 PDF，你必须提供 pages 参数读取特定页码范围（例如 pages: "1-5"）。不提供 pages 参数读取大型 PDF 会失败。每次请求最多 20 页。'
      : ''
  }
- 此工具可以读取 Jupyter notebook（.ipynb 文件），并返回所有单元格及其输出，包含代码、文本和可视化内容。
- 此工具只能读取文件，不能读取目录。要读取目录，请通过 ${BASH_TOOL_NAME} 工具运行 ls 命令。
- 你经常会被要求读取截图。如果用户提供截图路径，始终使用此工具查看该路径对应的文件。此工具适用于所有临时文件路径。
- 如果读取到一个存在但内容为空的文件，你会收到系统提醒，而不是文件内容。`
}
