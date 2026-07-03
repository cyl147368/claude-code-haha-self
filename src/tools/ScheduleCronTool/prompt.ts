import { feature } from 'bun:bundle'
import { getFeatureValue_CACHED_WITH_REFRESH } from '../../services/analytics/growthbook.js'
import { DEFAULT_CRON_JITTER_CONFIG } from '../../utils/cronTasks.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const KAIROS_CRON_REFRESH_MS = 5 * 60 * 1000

export const DEFAULT_MAX_AGE_DAYS =
  DEFAULT_CRON_JITTER_CONFIG.recurringMaxAgeMs / (24 * 60 * 60 * 1000)

/**
 * Unified gate for the cron scheduling system. Combines the build-time
 * `feature('AGENT_TRIGGERS')` flag (dead code elimination) with the runtime
 * `tengu_kairos_cron` GrowthBook gate on a 5-minute refresh window.
 *
 * AGENT_TRIGGERS is independently shippable from KAIROS — the cron module
 * graph (cronScheduler/cronTasks/cronTasksLock/cron.ts + the three tools +
 * /loop skill) has zero imports into src/assistant/ and no feature('KAIROS')
 * calls. The REPL.tsx kairosEnabled read is safe:
 * kairosEnabled is unconditionally in AppStateStore with default false, so
 * when KAIROS is off the scheduler just gets assistantMode: false.
 *
 * Called from Tool.isEnabled() (lazy, post-init) and inside useEffect /
 * imperative setup, never at module scope — so the disk cache has had a
 * chance to populate.
 *
 * The default is `true` — /loop is GA (announced in changelog). GrowthBook
 * is disabled for Bedrock/Vertex/Foundry and when DISABLE_TELEMETRY /
 * CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC are set; a `false` default would
 * break /loop for those users (GH #31759). The GB gate now serves purely as
 * a fleet-wide kill switch — flipping it to `false` stops already-running
 * schedulers on their next isKilled poll tick, not just new ones.
 *
 * `CLAUDE_CODE_DISABLE_CRON` is a local override that wins over GB.
 */
export function isKairosCronEnabled(): boolean {
  return feature('AGENT_TRIGGERS')
    ? !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_CRON) &&
        getFeatureValue_CACHED_WITH_REFRESH(
          'tengu_kairos_cron',
          true,
          KAIROS_CRON_REFRESH_MS,
        )
    : false
}

/**
 * Kill switch for disk-persistent (durable) cron tasks. Narrower than
 * {@link isKairosCronEnabled} — flipping this off forces `durable: false` at
 * the call() site, leaving session-only cron (in-memory, GA) untouched.
 *
 * Defaults to `true` so Bedrock/Vertex/Foundry and DISABLE_TELEMETRY users get
 * durable cron. Does NOT consult CLAUDE_CODE_DISABLE_CRON (that kills the whole
 * scheduler via isKairosCronEnabled).
 */
export function isDurableCronEnabled(): boolean {
  return getFeatureValue_CACHED_WITH_REFRESH(
    'tengu_kairos_cron_durable',
    true,
    KAIROS_CRON_REFRESH_MS,
  )
}

export const CRON_CREATE_TOOL_NAME = 'CronCreate'
export const CRON_DELETE_TOOL_NAME = 'CronDelete'
export const CRON_LIST_TOOL_NAME = 'CronList'

export function buildCronCreateDescription(durableEnabled: boolean): string {
  return durableEnabled
    ? '安排一个 prompt 在未来时间运行，可以按 cron 周期重复，也可以在特定时间运行一次。传 durable: true 可持久化到 .claude/scheduled_tasks.json；否则仅限当前会话。'
    : '在当前 Claude 会话中安排一个 prompt 在未来时间运行，可以按 cron 周期重复，也可以在特定时间运行一次。'
}

export function buildCronCreatePrompt(durableEnabled: boolean): string {
  const durabilitySection = durableEnabled
    ? `## 持久性

默认情况下（durable: false），job 只存在于当前 Claude 会话中；不会写入磁盘，Claude 退出后 job 消失。传 durable: true 会写入 .claude/scheduled_tasks.json，使 job 在重启后仍保留。只有当用户明确要求任务持久存在（"keep doing this every day"、"set this up permanently"）时才使用 durable: true。大多数 "remind me in 5 minutes" / "check back in an hour" 请求都应保持仅当前会话。`
    : `## 仅当前会话

Jobs 只存在于当前 Claude 会话中；不会写入磁盘，Claude 退出后 job 消失。`

  const durableRuntimeNote = durableEnabled
    ? 'Durable jobs 会持久化到 .claude/scheduled_tasks.json，并在会话重启后继续存在；下次启动时会自动恢复。REPL 关闭期间错过的一次性 durable tasks 会浮现出来供补做。仅当前会话 jobs 会随进程结束而消失。'
    : ''

  return `安排一个 prompt 在未来时间入队。可用于周期性 schedule 和一次性提醒。

使用用户本地 timezone 的标准 5 字段 cron：minute hour day-of-month month day-of-week。"0 9 * * *" 表示本地上午 9 点，不需要 timezone 转换。

## 一次性任务（recurring: false）

用于 "remind me at X" 或 "at <time>, do Y" 请求：触发一次后自动删除。
将 minute/hour/day-of-month/month 固定为具体值：
  "remind me at 2:30pm today to check the deploy" → cron: "30 14 <today_dom> <today_month> *", recurring: false
  "tomorrow morning, run the smoke test" → cron: "57 8 <tomorrow_dom> <tomorrow_month> *", recurring: false

## 周期性 jobs（recurring: true，默认）

用于 "every N minutes" / "every hour" / "weekdays at 9am" 请求：
  "*/5 * * * *" (every 5 min), "0 * * * *" (hourly), "0 9 * * 1-5" (weekdays at 9am local)

## 任务允许时，避开 :00 和 :30 分钟点

每个要求 "9am" 的用户都会得到 \`0 9\`，每个要求 "hourly" 的用户都会得到 \`0 *\`，这意味着全球请求会在同一瞬间打到 API。当用户请求是近似时间时，选择不是 0 或 30 的分钟：
  "every morning around 9" → "57 8 * * *" or "3 9 * * *" (not "0 9 * * *")
  "hourly" → "7 * * * *" (not "0 * * * *")
  "in an hour or so, remind me to..." → pick whatever minute you land on, don't round

只有当用户明确给出精确时间并显然就是这个意思时，才使用 0 或 30 分钟（例如 "at 9:00 sharp"、"at half past"、与会议对齐）。拿不准时，提前或延后几分钟；用户不会注意到，但系统整体会受益。

${durabilitySection}

## 运行时行为

Jobs 只会在 REPL 空闲时触发（不会在 query 中途触发）。${durableRuntimeNote} scheduler 会在你选择的时间上添加小的确定性 jitter：周期任务最多延迟其周期的 10%（最多 15 分钟）触发；落在 :00 或 :30 的一次性任务最多提前 90 秒触发。选择非整点/半点分钟仍然是更重要的杠杆。

周期性任务会在 ${DEFAULT_MAX_AGE_DAYS} 天后自动过期：最后触发一次，然后被删除。这限制了会话生命周期。安排周期性 jobs 时，请告知用户 ${DEFAULT_MAX_AGE_DAYS} 天限制。

返回一个 job ID，可传给 ${CRON_DELETE_TOOL_NAME}。`
}

export const CRON_DELETE_DESCRIPTION = '按 ID 取消已计划的 cron job'
export function buildCronDeletePrompt(durableEnabled: boolean): string {
  return durableEnabled
    ? `取消之前用 ${CRON_CREATE_TOOL_NAME} 安排的 cron job。将它从 .claude/scheduled_tasks.json（durable jobs）或内存会话存储（session-only jobs）中移除。`
    : `取消之前用 ${CRON_CREATE_TOOL_NAME} 安排的 cron job。将它从内存会话存储中移除。`
}

export const CRON_LIST_DESCRIPTION = '列出已计划的 cron jobs'
export function buildCronListPrompt(durableEnabled: boolean): string {
  return durableEnabled
    ? `列出通过 ${CRON_CREATE_TOOL_NAME} 安排的所有 cron jobs，包括 durable（.claude/scheduled_tasks.json）和 session-only。`
    : `列出当前会话中通过 ${CRON_CREATE_TOOL_NAME} 安排的所有 cron jobs。`
}
