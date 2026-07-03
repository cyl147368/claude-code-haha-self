import { EXIT_PLAN_MODE_TOOL_NAME } from '../ExitPlanModeTool/constants.js'

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const ASK_USER_QUESTION_TOOL_CHIP_WIDTH = 12

export const DESCRIPTION =
  '向用户提出选择题，用于收集信息、澄清歧义、了解偏好、做决策或提供选择。'

export const PREVIEW_FEATURE_PROMPT = {
  markdown: `
预览功能：
当展示需要用户视觉比较的具体产物时，可以在选项上使用可选的 \`preview\` 字段：
- UI 布局或组件的 ASCII mockup
- 展示不同实现的代码片段
- 图表变体
- 配置示例

预览内容会作为 markdown 渲染在等宽框中。支持带换行的多行文本。当任一选项包含 preview 时，UI 会切换为左右布局：左侧是垂直选项列表，右侧是预览。对于标签和描述已足够的简单偏好问题，不要使用预览。注意：预览仅支持单选问题（不支持 multiSelect）。
`,
  html: `
预览功能：
当展示需要用户视觉比较的具体产物时，可以在选项上使用可选的 \`preview\` 字段：
- UI 布局或组件的 HTML mockup
- 展示不同实现的格式化代码片段
- 视觉对比或图表

预览内容必须是自包含 HTML 片段（不要包含 <html>/<body> wrapper，不要包含 <script> 或 <style> 标签，请改用 inline style 属性）。对于标签和描述已足够的简单偏好问题，不要使用预览。注意：预览仅支持单选问题（不支持 multiSelect）。
`,
} as const

export const ASK_USER_QUESTION_TOOL_PROMPT = `执行过程中需要向用户提问时使用此工具。它可以帮助你：
1. 收集用户偏好或需求
2. 澄清含糊指令
3. 在工作过程中获得实现选择上的决策
4. 向用户提供下一步方向的选择

使用说明：
- 用户始终可以选择 "Other" 来提供自定义文本输入
- 使用 multiSelect: true 允许某个问题选择多个答案
- 如果你推荐某个特定选项，请把它放在列表第一项，并在 label 末尾添加 "(Recommended)"

计划模式注意事项：在计划模式中，请在最终确定计划前使用此工具澄清需求或在方案之间做选择。不要使用此工具询问 "Is my plan ready?" 或 "Should I proceed?"；计划批准应使用 ${EXIT_PLAN_MODE_TOOL_NAME}。重要：不要在问题中提到 "the plan"（例如 "Do you have feedback about the plan?"、"Does the plan look good?"），因为在你调用 ${EXIT_PLAN_MODE_TOOL_NAME} 前，用户无法在 UI 中看到计划。如果需要计划批准，请改用 ${EXIT_PLAN_MODE_TOOL_NAME}。
`
