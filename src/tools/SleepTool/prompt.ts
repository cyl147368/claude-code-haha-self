import { TICK_TAG } from '../../constants/xml.js'

export const SLEEP_TOOL_NAME = 'Sleep'

export const DESCRIPTION = '等待指定时长'

export const SLEEP_TOOL_PROMPT = `等待指定时长。用户可以随时中断 sleep。

当用户让你 sleep 或 rest、你没有事情可做，或正在等待某件事时使用此工具。

你可能会收到 <${TICK_TAG}> 提示，这是周期性检查。sleep 前先寻找是否有有用工作可做。

你可以将此工具与其他工具并发调用，它不会干扰其他工具。

优先使用此工具，而不是 \`Bash(sleep ...)\`，因为它不会占用 shell 进程。

每次唤醒都会消耗一次 API 调用，但 prompt cache 会在 5 分钟无活动后过期，请自行权衡。`
