export const WEB_FETCH_TOOL_NAME = 'WebFetch'

export const DESCRIPTION = `
- 从指定 URL 获取内容，并使用 AI 模型处理
- 接收 URL 和 prompt 作为输入
- 获取 URL 内容，并将 HTML 转换为 markdown
- 使用小型快速模型按 prompt 处理内容
- 返回模型对该内容的响应
- 当你需要检索并分析网页内容时使用此工具

使用说明：
  - 重要：如果存在 MCP 提供的 web fetch 工具，优先使用该工具而不是此工具，因为它限制可能更少。
  - URL 必须是完整且有效的 URL
  - HTTP URL 会自动升级为 HTTPS
  - prompt 应描述你想从页面中提取什么信息
  - 此工具是只读的，不会修改任何文件
  - 如果内容非常大，结果可能会被总结
  - 包含一个会自动清理的 15 分钟缓存，重复访问同一 URL 时响应更快
  - 当 URL 重定向到不同 host 时，工具会通知你，并以特殊格式提供重定向 URL。然后你应使用该重定向 URL 发起新的 WebFetch 请求来获取内容。
  - 对于 GitHub URL，优先通过 Bash 使用 gh CLI（例如 gh pr view、gh issue view、gh api）。
`

export function makeSecondaryModelPrompt(
  markdownContent: string,
  prompt: string,
  isPreapprovedDomain: boolean,
): string {
  const guidelines = isPreapprovedDomain
    ? `基于上方内容给出简洁回复。按需包含相关细节、代码示例和文档摘录。`
    : `只基于上方内容给出简洁回复。回复中：
 - 对任何来源文档的引用严格限制在最多 125 个字符。开源软件内容可以使用，但必须尊重许可证。
 - 对文章中的原文使用引号；引号之外的语言绝不能逐字复用原文。
 - 你不是律师，不要评论你自己的提示词或回复是否合法。
 - 绝不要生成或复现完整歌词。`

  return `
网页内容：
---
${markdownContent}
---

${prompt}

${guidelines}
`
}
