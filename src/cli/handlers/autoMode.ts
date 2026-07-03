/**
 * Auto mode 子命令处理器：dump 默认/合并后的分类器规则，并审查用户编写的规则。
 * 在运行 `claude auto-mode ...` 时动态导入。
 */

import { errorMessage } from '../../utils/errors.js'
import {
  getMainLoopModel,
  parseUserSpecifiedModel,
} from '../../utils/model/model.js'
import {
  type AutoModeRules,
  buildDefaultExternalSystemPrompt,
  getDefaultExternalAutoModeRules,
} from '../../utils/permissions/yoloClassifier.js'
import { getAutoModeConfig } from '../../utils/settings/settings.js'
import { sideQuery } from '../../utils/sideQuery.js'
import { jsonStringify } from '../../utils/slowOperations.js'

function writeRules(rules: AutoModeRules): void {
  process.stdout.write(jsonStringify(rules, null, 2) + '\n')
}

export function autoModeDefaultsHandler(): void {
  writeRules(getDefaultExternalAutoModeRules())
}

/**
 * 输出生效的 auto mode 配置：用户设置优先，否则使用外部默认值。
 * 每个 section 使用 REPLACE 语义；这与 buildYoloSystemPrompt 解析外部模板的方式一致。
 */
export function autoModeConfigHandler(): void {
  const config = getAutoModeConfig()
  const defaults = getDefaultExternalAutoModeRules()
  writeRules({
    allow: config?.allow?.length ? config.allow : defaults.allow,
    soft_deny: config?.soft_deny?.length
      ? config.soft_deny
      : defaults.soft_deny,
    environment: config?.environment?.length
      ? config.environment
      : defaults.environment,
  })
}

const CRITIQUE_SYSTEM_PROMPT =
  '你是 Claude Code auto mode 分类器规则的专家审查员。\n' +
  '\n' +
  'Claude Code 有一个 "auto mode"，它会用 AI 分类器判断工具调用应自动批准，还是需要用户确认。用户可以在三个类别中编写自定义规则：\n' +
  '\n' +
  '- **allow**：分类器应自动批准的操作\n' +
  '- **soft_deny**：分类器应阻止并要求用户确认的操作\n' +
  '- **environment**：关于用户环境的上下文，帮助分类器做决定\n' +
  '\n' +
  '你的工作是审查用户自定义规则的清晰度、完整性和潜在问题。该分类器是一个 LLM，会把这些规则作为 system prompt 的一部分来阅读。\n' +
  '\n' +
  '对每条规则评估：\n' +
  '1. **清晰度**：规则是否明确？分类器会不会误解？\n' +
  '2. **完整性**：是否有未覆盖的缺口或边界情况？\n' +
  '3. **冲突**：规则之间是否互相冲突？\n' +
  '4. **可执行性**：规则是否足够具体，能让分类器据此行动？\n' +
  '\n' +
  '保持简洁、建设性。只评论可以改进的规则。如果所有规则看起来都没问题，请明确说明。'

export async function autoModeCritiqueHandler(options: {
  model?: string
}): Promise<void> {
  const config = getAutoModeConfig()
  const hasCustomRules =
    (config?.allow?.length ?? 0) > 0 ||
    (config?.soft_deny?.length ?? 0) > 0 ||
    (config?.environment?.length ?? 0) > 0

  if (!hasCustomRules) {
    process.stdout.write(
      '未找到自定义 auto mode 规则。\n\n' +
        '请在 settings 文件的 autoMode.{allow, soft_deny, environment} 下添加规则。\n' +
        '运行 `claude auto-mode defaults` 可查看默认规则作为参考。\n',
    )
    return
  }

  const model = options.model
    ? parseUserSpecifiedModel(options.model)
    : getMainLoopModel()

  const defaults = getDefaultExternalAutoModeRules()
  const classifierPrompt = buildDefaultExternalSystemPrompt()

  const userRulesSummary =
    formatRulesForCritique('allow', config?.allow ?? [], defaults.allow) +
    formatRulesForCritique(
      'soft_deny',
      config?.soft_deny ?? [],
      defaults.soft_deny,
    ) +
    formatRulesForCritique(
      'environment',
      config?.environment ?? [],
      defaults.environment,
    )

  process.stdout.write('正在分析你的 auto mode 规则...\n\n')

  let response
  try {
    response = await sideQuery({
      querySource: 'auto_mode_critique',
      model,
      system: CRITIQUE_SYSTEM_PROMPT,
      skipSystemPromptPrefix: true,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content:
            '这是 auto mode 分类器收到的完整 classifier system prompt：\n\n' +
            '<classifier_system_prompt>\n' +
            classifierPrompt +
            '\n</classifier_system_prompt>\n\n' +
            '下面是用户自定义规则，它们会替换对应默认 section：\n\n' +
            userRulesSummary +
            '\n请审查这些自定义规则。',
        },
      ],
    })
  } catch (error) {
    process.stderr.write('规则分析失败：' + errorMessage(error) + '\n')
    process.exitCode = 1
    return
  }

  const textBlock = response.content.find(block => block.type === 'text')
  if (textBlock?.type === 'text') {
    process.stdout.write(textBlock.text + '\n')
  } else {
    process.stdout.write('未生成审查结果。请重试。\n')
  }
}

function formatRulesForCritique(
  section: string,
  userRules: string[],
  defaultRules: string[],
): string {
  if (userRules.length === 0) return ''
  const customLines = userRules.map(r => '- ' + r).join('\n')
  const defaultLines = defaultRules.map(r => '- ' + r).join('\n')
  return (
    '## ' +
    section +
    '（替换默认值的自定义规则）\n' +
    '自定义规则：\n' +
    customLines +
    '\n\n' +
    '被替换的默认规则：\n' +
    defaultLines +
    '\n\n'
  )
}
