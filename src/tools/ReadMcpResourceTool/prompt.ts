export const DESCRIPTION = `
从 MCP server 读取特定 resource。
- server：要读取的 MCP server 名称
- uri：要读取的 resource URI

使用示例：
- 从 server 读取 resource：\`readMcpResource({ server: "myserver", uri: "my-resource-uri" })\`
`

export const PROMPT = `
按 server name 和 resource URI 标识并读取 MCP server 中的特定 resource。

参数：
- server（必需）：要读取 resource 的 MCP server 名称
- uri（必需）：要读取的 resource URI
`
