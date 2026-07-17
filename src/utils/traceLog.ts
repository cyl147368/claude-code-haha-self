import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

const TRACE_LOG_MAX_FILES = 50
const TRACE_LOG_MAX_TOTAL_BYTES = 100 * 1024 * 1024

export type TraceLog = {
  path: string
  append(content: string): void
}

export function createTraceLog({
  sessionId,
  requestTime,
  querySource,
  userRequest,
  workspaceRoot = process.cwd(),
  agentId,
}: {
  sessionId: string
  requestTime: Date
  querySource: string
  userRequest: string
  workspaceRoot?: string
  agentId?: string
}): TraceLog | undefined {
  try {
    const resolvedWorkspaceRoot = resolve(workspaceRoot)
    const traceLogDir = join(resolvedWorkspaceRoot, '.ylcoder', 'trace-logs')
    mkdirSync(traceLogDir, { recursive: true })

    const identity = agentId ? `${sessionId}:${agentId}` : sessionId
    const traceLogId = createHash('sha256')
      .update(identity)
      .digest('hex')
      .slice(0, 16)
    const filePath = resolve(
      traceLogDir,
      `claude-haha-trace-${traceLogId}.log`,
    )
    const requestHeader = [
      '## 新一轮请求',
      '',
      `- 请求时间：${requestTime.toISOString()}`,
      `- 运行来源：${querySource}`,
      `- 用户请求：${userRequest}`,
      '',
      '---',
      '',
    ].join('\n')

    if (existsSync(filePath)) {
      appendFileSync(filePath, `\n${requestHeader}`, 'utf8')
    } else {
      writeFileSync(
        filePath,
        [
          '# Claude Code Haha 会话执行过程',
          '',
          `- 会话编号：${sessionId}`,
          `- 工作空间：${resolvedWorkspaceRoot}`,
          ...(agentId ? [`- Agent 编号：${agentId}`] : []),
          '',
          '---',
          '',
          requestHeader,
        ].join('\n'),
        'utf8',
      )
    }

    cleanupTraceLogs(traceLogDir)

    return {
      path: filePath,
      append(content: string) {
        try {
          appendFileSync(filePath, `\n${content}\n`, 'utf8')
        } catch {
          // 过程日志不能阻断正常的模型请求和工具执行。
        }
      },
    }
  } catch {
    return undefined
  }
}

function cleanupTraceLogs(traceLogDir: string): void {
  try {
    const files = readdirSync(traceLogDir)
      .filter(
        name =>
          name.startsWith('claude-haha-trace-') && name.endsWith('.log'),
      )
      .map(name => {
        const path = join(traceLogDir, name)
        const stats = statSync(path)
        return { path, size: stats.size, modifiedAt: stats.mtimeMs }
      })
      .sort((left, right) => right.modifiedAt - left.modifiedAt)

    let keptFiles = 0
    let keptBytes = 0
    for (const file of files) {
      const canKeepFile = keptFiles < TRACE_LOG_MAX_FILES
      const canKeepBytes =
        keptFiles === 0 || keptBytes + file.size <= TRACE_LOG_MAX_TOTAL_BYTES
      if (canKeepFile && canKeepBytes) {
        keptFiles += 1
        keptBytes += file.size
      } else {
        unlinkSync(file.path)
      }
    }
  } catch {
    // 清理旧日志失败时仍保留本次请求的日志。
  }
}
