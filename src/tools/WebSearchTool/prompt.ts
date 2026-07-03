import { getLocalMonthYear } from 'src/constants/common.js'

export const WEB_SEARCH_TOOL_NAME = 'WebSearch'

export function getWebSearchPrompt(): string {
  const currentMonthYear = getLocalMonthYear()
  return `
- 允许 Claude 搜索网页，并使用搜索结果辅助回答
- 为当前事件和近期数据提供最新信息
- 以搜索结果块格式返回搜索结果信息，其中链接为 markdown 超链接
- 当需要访问超出 Claude 知识截止时间的信息时使用此工具
- 搜索会在单次 API 调用内自动完成

关键要求：你必须遵守：
  - 回答用户问题后，必须在回复末尾包含 "Sources:" 部分
  - 在 Sources 部分中，把搜索结果里的所有相关 URL 作为 markdown 超链接列出：[Title](URL)
  - 这是强制要求，不要跳过来源
  - 示例格式：

    [Your answer here]

    Sources:
    - [Source Title 1](https://example.com/1)
    - [Source Title 2](https://example.com/2)

使用说明：
  - 支持 domain filtering，用于包含或屏蔽特定网站
  - Web search 仅在美国可用

重要：搜索查询中使用正确年份：
  - 当前月份是 ${currentMonthYear}。搜索近期信息、文档或当前事件时，必须使用今年年份。
  - 示例：如果用户询问 "latest React docs"，请搜索包含当前年份的 "React documentation"，不要使用去年年份
`
}
