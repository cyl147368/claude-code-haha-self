export const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResourcesTool'

export const DESCRIPTION = `
列出已配置 MCP servers 中的可用 resources。
每个 resource object 都包含 'server' 字段，表示它来自哪个 server。

使用示例：
- 列出所有 servers 的所有 resources：\`listMcpResources\`
- 列出特定 server 的 resources：\`listMcpResources({ server: "myserver" })\`
`

export const PROMPT = `
列出已配置 MCP servers 中的可用 resources。
每个返回的 resource 都会包含所有标准 MCP resource 字段，以及一个表示该 resource 属于哪个 server 的 'server' 字段。

参数：
- server（可选）：要获取 resources 的特定 MCP server 名称。如未提供，将返回所有 servers 的 resources。
`
