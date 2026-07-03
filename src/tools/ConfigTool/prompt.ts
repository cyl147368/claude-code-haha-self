import { feature } from 'bun:bundle'
import { getModelOptions } from '../../utils/model/modelOptions.js'
import { isVoiceGrowthBookEnabled } from '../../voice/voiceModeEnabled.js'
import {
  getOptionsForSetting,
  SUPPORTED_SETTINGS,
} from './supportedSettings.js'

export const DESCRIPTION = '获取或设置 Claude Code 配置项。'

/**
 * Generate the prompt documentation from the registry
 */
export function generatePrompt(): string {
  const globalSettings: string[] = []
  const projectSettings: string[] = []

  for (const [key, config] of Object.entries(SUPPORTED_SETTINGS)) {
    // Skip model - it gets its own section with dynamic options
    if (key === 'model') continue
    // Voice settings are registered at build-time but gated by GrowthBook
    // at runtime. Hide from model prompt when the kill-switch is on.
    if (
      feature('VOICE_MODE') &&
      key === 'voiceEnabled' &&
      !isVoiceGrowthBookEnabled()
    )
      continue

    const options = getOptionsForSetting(key)
    let line = `- ${key}`

    if (options) {
      line += `: ${options.map(o => `"${o}"`).join(', ')}`
    } else if (config.type === 'boolean') {
      line += `: true/false`
    }

    line += ` - ${config.description}`

    if (config.source === 'global') {
      globalSettings.push(line)
    } else {
      projectSettings.push(line)
    }
  }

  const modelSection = generateModelSection()

  return `获取或设置 Claude Code 配置项。

  查看或修改 Claude Code 设置。当用户要求修改配置、询问当前设置，或调整某个设置会对用户有帮助时使用。


## 用法
- **获取当前值：** 省略 "value" 参数
- **设置新值：** 包含 "value" 参数

## 可配置设置列表
以下设置可由你修改：

### 全局设置（存储在 ~/.claude.json）
${globalSettings.join('\n')}

### 项目设置（存储在 settings.json）
${projectSettings.join('\n')}

${modelSection}
## 示例
- 获取 theme：{ "setting": "theme" }
- 设置 dark theme：{ "setting": "theme", "value": "dark" }
- 启用 vim mode：{ "setting": "editorMode", "value": "vim" }
- 启用 verbose：{ "setting": "verbose", "value": true }
- 更改 model：{ "setting": "model", "value": "opus" }
- 更改 permission mode：{ "setting": "permissions.defaultMode", "value": "plan" }
`
}

function generateModelSection(): string {
  try {
    const options = getModelOptions()
    const lines = options.map(o => {
      const value = o.value === null ? 'null/"default"' : `"${o.value}"`
      return `  - ${value}: ${o.descriptionForModel ?? o.description}`
    })
    return `## 模型
- model - 覆盖默认模型。可用选项：
${lines.join('\n')}`
  } catch {
    return `## 模型
- model - 覆盖默认模型（sonnet、opus、haiku、best 或完整 model ID）`
  }
}
