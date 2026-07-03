import { feature } from 'bun:bundle'

export const DESCRIPTION = '向另一个 agent 发送消息'

export function getPrompt(): string {
  const udsRow = feature('UDS_INBOX')
    ? `\n| \`"uds:/path/to.sock"\` | 本地 Claude session 的 socket（同一台机器；使用 \`ListPeers\`） |
| \`"bridge:session_..."\` | Remote Control peer session（跨机器；使用 \`ListPeers\`） |`
    : ''
  const udsSection = feature('UDS_INBOX')
    ? `\n\n## 跨 session

使用 \`ListPeers\` 发现目标，然后：

\`\`\`json
{"to": "uds:/tmp/cc-socks/1234.sock", "message": "check if tests pass over there"}
{"to": "bridge:session_01AbCd...", "message": "what branch are you on?"}
\`\`\`

列出的 peer 是活跃的，并会处理你的消息；没有 "busy" 状态。消息会入队，并在接收方下一次工具轮次中处理。你的消息会被包装为 \`<cross-session-message from="...">\` 到达。**回复传入消息时，把它的 \`from\` 属性复制为你的 \`to\`。**`
    : ''
  return `
# SendMessage

向另一个 agent 发送消息。

\`\`\`json
{"to": "researcher", "summary": "assign task 1", "message": "start on task #1"}
\`\`\`

| \`to\` | |
|---|---|
| \`"researcher"\` | 按名称指定 teammate |
| \`"*"\` | 广播给所有 teammates，成本高（随 team 大小线性增长），仅在所有人确实都需要时使用 |${udsRow}

你的纯文本输出对其他 agents 不可见。要沟通，必须调用此工具。来自 teammates 的消息会自动投递，你不需要检查 inbox。用名称称呼 teammates，绝不要用 UUID。转述时不要引用原文，因为它已经渲染给用户。${udsSection}

## 协议响应（legacy）

如果收到 \`type: "shutdown_request"\` 或 \`type: "plan_approval_request"\` 的 JSON 消息，请用匹配的 \`_response\` 类型回复，并 echo \`request_id\`，设置 \`approve\` 为 true/false：

\`\`\`json
{"to": "team-lead", "message": {"type": "shutdown_response", "request_id": "...", "approve": true}}
{"to": "researcher", "message": {"type": "plan_approval_response", "request_id": "...", "approve": false, "feedback": "add error handling"}}
\`\`\`

批准 shutdown 会终止你的进程。拒绝 plan 会让 teammate 回去修改。除非被要求，否则不要主动发起 \`shutdown_request\`。不要发送结构化 JSON 状态消息，请使用 TaskUpdate。
`.trim()
}
