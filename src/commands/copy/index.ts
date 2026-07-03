/**
 * copy 命令只保留最小元数据。
 * 实现在 copy.tsx 中懒加载，以减少启动时间。
 */
import type { Command } from '../../commands.js'

const copy = {
  type: 'local-jsx',
  name: 'copy',
  description:
    '将 Claude 的上一条回复复制到剪贴板（或用 /copy N 复制倒数第 N 条）',
  load: () => import('./copy.js'),
} satisfies Command

export default copy
