import { getInitialSettings } from '../utils/settings/settings.js'

export function getSpinnerVerbs(): string[] {
  const settings = getInitialSettings()
  const config = settings.spinnerVerbs
  if (!config) {
    return SPINNER_VERBS
  }
  if (config.mode === 'replace') {
    return config.verbs.length > 0 ? config.verbs : SPINNER_VERBS
  }
  return [...SPINNER_VERBS, ...config.verbs]
}

// Spinner verbs for loading messages
export const SPINNER_VERBS = [
  '思考中',
  '分析中',
  '整理中',
  '推理中',
  '规划中',
  '检索中',
  '读取中',
  '计算中',
  '生成中',
  '处理中',
  '确认中',
  '汇总中',
  '编排中',
  '构建中',
  '检查中',
  '验证中',
  '准备中',
  '对齐中',
  '收敛中',
  '继续中',
]
