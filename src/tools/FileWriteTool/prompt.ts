import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

export const FILE_WRITE_TOOL_NAME = 'Write'
export const DESCRIPTION = '向本地文件系统写入文件。'

function getPreReadInstruction(): string {
  return `\n- 如果这是现有文件，你必须先使用 ${FILE_READ_TOOL_NAME} 工具读取文件内容。如果未先读取文件，此工具会失败。`
}

export function getWriteToolDescription(): string {
  return `向本地文件系统写入文件。

用法：
- 如果提供路径上已有文件，此工具会覆盖该文件。${getPreReadInstruction()}
- 修改现有文件时优先使用 Edit 工具，因为它只发送差异。只有在创建新文件或完整重写时才使用此工具。
- 除非用户明确要求，否则绝不要创建文档文件（*.md）或 README 文件。
- 只有当用户明确要求时才使用 emoji。除非用户要求，否则不要向文件中写入 emoji。`
}
