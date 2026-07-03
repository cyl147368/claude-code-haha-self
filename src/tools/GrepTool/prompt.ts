import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

export const GREP_TOOL_NAME = 'Grep'

export function getDescription(): string {
  return `基于 ripgrep 构建的强大搜索工具

  使用方法：
  - 搜索任务始终使用 ${GREP_TOOL_NAME}。绝不要通过 ${BASH_TOOL_NAME} 命令调用 \`grep\` 或 \`rg\`。${GREP_TOOL_NAME} 已针对正确权限和访问进行了优化。
  - 支持完整正则语法（例如 "log.*Error"、"function\\s+\\w+"）
  - 可用 glob 参数（例如 "*.js"、"**/*.tsx"）或 type 参数（例如 "js"、"py"、"rust"）过滤文件
  - 输出模式："content" 显示匹配行，"files_with_matches" 只显示文件路径（默认），"count" 显示匹配数量
  - 对于需要多轮的开放式搜索，请使用 ${AGENT_TOOL_NAME} 工具
  - 模式语法：使用 ripgrep（不是 grep）。字面量花括号需要转义（在 Go 代码中查找 \`interface{}\` 时，使用 \`interface\\{\\}\`）
  - 多行匹配：默认情况下，pattern 只在单行内匹配。对于 \`struct \\{[\\s\\S]*?field\` 这类跨行 pattern，请使用 \`multiline: true\`
`
}
