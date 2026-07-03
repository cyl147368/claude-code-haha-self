export const REMOTE_TRIGGER_TOOL_NAME = 'RemoteTrigger'

export const DESCRIPTION =
  '通过 claude.ai CCR API 管理计划中的远程 Claude Code agents（triggers）。认证在进程内处理，token 绝不会进入 shell。'

export const PROMPT = `调用 claude.ai remote-trigger API。请使用此工具而不是 curl；OAuth token 会在进程内自动添加，且不会暴露。

操作：
- list: GET /v1/code/triggers
- get: GET /v1/code/triggers/{trigger_id}
- create: POST /v1/code/triggers (requires body)
- update: POST /v1/code/triggers/{trigger_id} (requires body, partial update)
- run: POST /v1/code/triggers/{trigger_id}/run

响应是 API 返回的原始 JSON。`
