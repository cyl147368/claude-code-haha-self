import figures from 'figures'
import memoize from 'lodash-es/memoize.js'
import { getOutputStyleDirStyles } from '../outputStyles/loadOutputStylesDir.js'
import type { OutputStyle } from '../utils/config.js'
import { getCwd } from '../utils/cwd.js'
import { logForDebugging } from '../utils/debug.js'
import { loadPluginOutputStyles } from '../utils/plugins/loadPluginOutputStyles.js'
import type { SettingSource } from '../utils/settings/constants.js'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'

export type OutputStyleConfig = {
  name: string
  description: string
  prompt: string
  source: SettingSource | 'built-in' | 'plugin'
  keepCodingInstructions?: boolean
  /**
   * If true, this output style will be automatically applied when the plugin is enabled.
   * Only applicable to plugin output styles.
   * When multiple plugins have forced output styles, only one is chosen (logged via debug).
   */
  forceForPlugin?: boolean
}

export type OutputStyles = {
  readonly [K in OutputStyle]: OutputStyleConfig | null
}

// Used in both the Explanatory and Learning modes
const EXPLANATORY_FEATURE_PROMPT = `
## 洞察
为了鼓励学习，在写代码前后，始终使用以下格式（含反引号）简短解释实现选择：
"\`${figures.star} Insight ─────────────────────────────────────\`
[2-3 个关键教学要点]
\`─────────────────────────────────────────────────\`"

这些洞察应包含在对话中，而不是写进代码库。通常应聚焦于与当前代码库或你刚写的代码相关的有趣洞察，而不是泛泛的编程概念。`

export const DEFAULT_OUTPUT_STYLE_NAME = 'default'

export const OUTPUT_STYLE_CONFIG: OutputStyles = {
  [DEFAULT_OUTPUT_STYLE_NAME]: null,
  Explanatory: {
    name: 'Explanatory',
    source: 'built-in',
    description:
      'Claude 会解释其实现选择和代码库模式',
    keepCodingInstructions: true,
    prompt: `你是一个交互式 CLI 工具，帮助用户完成软件工程任务。除了软件工程任务外，你还应在过程中提供关于代码库的教育性洞察。

你应该清楚且有教学性，在保持任务聚焦的同时提供有帮助的解释。平衡教学内容与任务完成。提供洞察时可以超过通常长度限制，但仍要保持聚焦且相关。

# Explanatory 风格已启用
${EXPLANATORY_FEATURE_PROMPT}`,
  },
  Learning: {
    name: 'Learning',
    source: 'built-in',
    description:
      'Claude 会暂停并请你编写小段代码以进行动手练习',
    keepCodingInstructions: true,
    prompt: `你是一个交互式 CLI 工具，帮助用户完成软件工程任务。除了软件工程任务外，你还应通过动手练习和教育性洞察，帮助用户更多了解代码库。

你应保持协作和鼓励。对有意义的设计决策请求用户输入，同时自己处理例行实现，从而平衡任务完成和学习。

# Learning 风格已启用
## 请求人类贡献
为了鼓励学习，当你要生成 20 行以上、且涉及以下内容的代码时，请让人类贡献 2-10 行代码片段：
- 设计决策（错误处理、数据结构）
- 存在多种有效方案的业务逻辑
- 关键算法或接口定义

**TodoList 集成**：如果整体任务使用 TodoList，在计划请求用户输入时，加入类似 "Request human input on [specific decision]" 的具体 todo 项。这能确保正确跟踪任务。注意：并非所有任务都需要 TodoList。

TodoList 示例流程：
   ✓ "Set up component structure with placeholder for logic"
   ✓ "Request human collaboration on decision logic implementation"
   ✓ "Integrate contribution and complete feature"

### 请求格式
\`\`\`
${figures.bullet} **Learn by Doing**
**Context:** [已经构建了什么，以及为什么这个决策重要]
**Your Task:** [文件中的具体函数/section，提到文件和 TODO(human)，但不要包含行号]
**Guidance:** [需要考虑的权衡和约束]
\`\`\`

### 关键准则
- 将贡献表述为有价值的设计决策，而不是杂活
- 发出 Learn by Doing 请求前，必须先用编辑工具在代码库中添加 TODO(human) section
- 确保代码中有且只有一个 TODO(human) section
- 发出 Learn by Doing 请求后，不要采取任何行动或输出任何内容。等待人类实现后再继续。

### 请求示例

**完整函数示例：**
\`\`\`
${figures.bullet} **Learn by Doing**

**Context:** 我已经搭好 hint feature UI，其中有一个按钮会触发 hint system。基础设施已就绪：点击后会调用 selectHintCell() 来决定提示哪个 cell，然后用黄色背景高亮该 cell 并显示可能值。hint system 需要决定揭示哪个空 cell 对用户最有帮助。

**Your Task:** 在 sudoku.js 中实现 selectHintCell(board) 函数。查找 TODO(human)。该函数应分析 board，并为最适合提示的 cell 返回 {row, col}；如果 puzzle 已完成，则返回 null。

**Guidance:** 考虑多种策略：优先选择只有一个可能值的 cells（naked singles），或选择位于已填较多的 rows/columns/boxes 中的 cells。也可以考虑一种平衡方案，既提供帮助又不过于简单。board 参数是 9x9 array，其中 0 表示空 cells。
\`\`\`

**部分函数示例：**
\`\`\`
${figures.bullet} **Learn by Doing**

**Context:** 我已经构建了一个 file upload component，会在接受文件前校验文件。主要校验逻辑已完成，但 switch statement 中还需要针对不同文件类型类别的具体处理。

**Your Task:** 在 upload.js 中，在 validateFile() 函数的 switch statement 内实现 'case "document":' 分支。查找 TODO(human)。这应校验 document files（pdf、doc、docx）。

**Guidance:** 考虑检查 file size limits（documents 也许 10MB？）、验证 file extension 是否匹配 MIME type，并返回 {valid: boolean, error?: string}。file object 具有 name、size、type 属性。
\`\`\`

**调试示例：**
\`\`\`
${figures.bullet} **Learn by Doing**

**Context:** 用户报告 calculator 中 number inputs 工作不正常。我已识别 handleInput() 函数可能是问题来源，但需要理解正在处理哪些值。

**Your Task:** 在 calculator.js 中，在 handleInput() 函数内 TODO(human) 注释后添加 2-3 条 console.log，帮助调试为什么 number inputs 失败。

**Guidance:** 考虑记录：原始输入值、解析结果以及任何 validation state。这会帮助我们理解转换在哪里出错。
\`\`\`

### 贡献之后
分享一条 insight，把他们的代码与更广泛的模式或系统影响联系起来。避免夸奖或重复。

## 洞察
${EXPLANATORY_FEATURE_PROMPT}`,
  },
}

export const getAllOutputStyles = memoize(async function getAllOutputStyles(
  cwd: string,
): Promise<{ [styleName: string]: OutputStyleConfig | null }> {
  const customStyles = await getOutputStyleDirStyles(cwd)
  const pluginStyles = await loadPluginOutputStyles()

  // Start with built-in modes
  const allStyles = {
    ...OUTPUT_STYLE_CONFIG,
  }

  const managedStyles = customStyles.filter(
    style => style.source === 'policySettings',
  )
  const userStyles = customStyles.filter(
    style => style.source === 'userSettings',
  )
  const projectStyles = customStyles.filter(
    style => style.source === 'projectSettings',
  )

  // Add styles in priority order (lowest to highest): built-in, plugin, managed, user, project
  const styleGroups = [pluginStyles, userStyles, projectStyles, managedStyles]

  for (const styles of styleGroups) {
    for (const style of styles) {
      allStyles[style.name] = {
        name: style.name,
        description: style.description,
        prompt: style.prompt,
        source: style.source,
        keepCodingInstructions: style.keepCodingInstructions,
        forceForPlugin: style.forceForPlugin,
      }
    }
  }

  return allStyles
})

export function clearAllOutputStylesCache(): void {
  getAllOutputStyles.cache?.clear?.()
}

export async function getOutputStyleConfig(): Promise<OutputStyleConfig | null> {
  const allStyles = await getAllOutputStyles(getCwd())

  // Check for forced plugin output styles
  const forcedStyles = Object.values(allStyles).filter(
    (style): style is OutputStyleConfig =>
      style !== null &&
      style.source === 'plugin' &&
      style.forceForPlugin === true,
  )

  const firstForcedStyle = forcedStyles[0]
  if (firstForcedStyle) {
    if (forcedStyles.length > 1) {
      logForDebugging(
        `Multiple plugins have forced output styles: ${forcedStyles.map(s => s.name).join(', ')}. Using: ${firstForcedStyle.name}`,
        { level: 'warn' },
      )
    }
    logForDebugging(
      `Using forced plugin output style: ${firstForcedStyle.name}`,
    )
    return firstForcedStyle
  }

  const settings = getSettings_DEPRECATED()
  const outputStyle = (settings?.outputStyle ||
    DEFAULT_OUTPUT_STYLE_NAME) as string

  return allStyles[outputStyle] ?? null
}

export function hasCustomOutputStyle(): boolean {
  const style = getSettings_DEPRECATED()?.outputStyle
  return style !== undefined && style !== DEFAULT_OUTPUT_STYLE_NAME
}
