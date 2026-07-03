import { isPlanModeInterviewPhaseEnabled } from '../../utils/planModeV2.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../AskUserQuestionTool/prompt.js'

const WHAT_HAPPENS_SECTION = `## 计划模式中会发生什么

在计划模式中，你将：
1. 使用 Glob、Grep 和 Read 工具彻底探索代码库
2. 理解现有模式和架构
3. 设计实现方案
4. 将计划提交给用户批准
5. 如果需要澄清方案，使用 ${ASK_USER_QUESTION_TOOL_NAME}
6. 准备实现时，通过 ExitPlanMode 退出计划模式

`

function getEnterPlanModeToolPromptExternal(): string {
  // When interview phase is enabled, omit the "What Happens" section —
  // detailed workflow instructions arrive via the plan_mode attachment (messages.ts).
  const whatHappens = isPlanModeInterviewPhaseEnabled()
    ? ''
    : WHAT_HAPPENS_SECTION

  return `当你准备开始非平凡实现任务时，主动使用此工具。写代码前让用户确认你的方案，可以避免无效工作并确保方向一致。此工具会让你进入计划模式，在其中探索代码库并设计实现方案，供用户批准。

## 何时使用此工具

除非实现任务很简单，否则**优先使用 EnterPlanMode**。满足以下任一条件时使用：

1. **实现新功能**：添加有意义的新功能
   - 示例："Add a logout button"：按钮放在哪里？点击后发生什么？
   - 示例："Add form validation"：规则是什么？错误消息是什么？

2. **存在多个有效方案**：任务可以用几种不同方式解决
   - 示例："Add caching to the API"：可以用 Redis、内存、文件等
   - 示例："Improve performance"：可能有多种优化策略

3. **代码修改**：会影响现有行为或结构的改动
   - 示例："Update the login flow"：具体要改什么？
   - 示例："Refactor this component"：目标架构是什么？

4. **架构决策**：任务需要在模式或技术之间做选择
   - 示例："Add real-time updates"：WebSockets、SSE 还是 polling
   - 示例："Implement state management"：Redux、Context 还是自定义方案

5. **多文件改动**：任务很可能触及 2-3 个以上文件
   - 示例："Refactor the authentication system"
   - 示例："Add a new API endpoint with tests"

6. **需求不清楚**：需要先探索才能理解完整范围
   - 示例："Make the app faster"：需要 profile 并识别瓶颈
   - 示例："Fix the bug in checkout"：需要调查根因

7. **用户偏好很重要**：实现方向合理地存在多种选择
   - 如果你会使用 ${ASK_USER_QUESTION_TOOL_NAME} 澄清方案，请改用 EnterPlanMode
   - 计划模式允许你先探索，再带上下文呈现选项

## 何时不要使用此工具

只对简单任务跳过 EnterPlanMode：
- 单行或少量行修复（typo、明显 bug、小调整）
- 添加需求清晰的单个函数
- 用户已给出非常具体、详细的指令
- 纯研究/探索任务（改用 Agent 工具和 explore agent）

${whatHappens}## 示例

### 好例子：使用 EnterPlanMode
User: "Add user authentication to the app"
- 需要架构决策（session vs JWT、token 存放位置、middleware 结构）

User: "Optimize the database queries"
- 存在多种方案，需要先 profile，影响较大

User: "Implement dark mode"
- 需要决定 theme system 架构，影响许多组件

User: "Add a delete button to the user profile"
- 看似简单，但涉及：放置位置、确认对话框、API 调用、错误处理、状态更新

User: "Update the error handling in the API"
- 影响多个文件，用户应批准方案

### 坏例子：不要使用 EnterPlanMode
User: "Fix the typo in the README"
- 直接明了，不需要规划

User: "Add a console.log to debug this function"
- 简单且实现明显

User: "What files handle routing?"
- 这是研究任务，不是实现规划

## 重要说明

- 此工具需要用户批准，用户必须同意进入计划模式
- 如果不确定是否使用，偏向于规划：提前对齐比返工更好
- 在对代码库做重大改动前被征询意见，用户通常会更安心
`
}

function getEnterPlanModeToolPromptAnt(): string {
  // When interview phase is enabled, omit the "What Happens" section —
  // detailed workflow instructions arrive via the plan_mode attachment (messages.ts).
  const whatHappens = isPlanModeInterviewPhaseEnabled()
    ? ''
    : WHAT_HAPPENS_SECTION

  return `当任务的正确方案确实存在歧义，并且写代码前获取用户输入能避免大量返工时，使用此工具。此工具会让你进入计划模式，在其中探索代码库并设计实现方案，供用户批准。

## 何时使用此工具

当实现方案确实不清楚时，计划模式很有价值。以下情况使用：

1. **显著架构歧义**：存在多个合理方案，且选择会实质影响代码库
   - 示例："Add caching to the API"：Redis vs in-memory vs file-based
   - 示例："Add real-time updates"：WebSockets vs SSE vs polling

2. **需求不清楚**：需要先探索和澄清，才能继续推进
   - 示例："Make the app faster"：需要 profile 并识别瓶颈
   - 示例："Refactor this module"：需要理解目标架构应该是什么

3. **高影响重构**：任务会显著重构现有代码，先获得认可可降低风险
   - 示例："Redesign the authentication system"
   - 示例："Migrate from one state management approach to another"

## 何时不要使用此工具

当你能合理推断正确方案时，跳过计划模式：
- 任务直接明了，即使触及多个文件
- 用户请求足够具体，实现路径清楚
- 你添加的功能有明显实现模式（例如按现有约定添加按钮或新 endpoint）
- bug 修复在理解 bug 后修法明确
- 研究/探索任务（改用 Agent 工具）
- 用户说类似 "can we work on X" 或 "let's do X" 时，直接开始

拿不准时，优先开始工作，并用 ${ASK_USER_QUESTION_TOOL_NAME} 提具体问题，而不是进入完整规划阶段。

${whatHappens}## 示例

### 好例子：使用 EnterPlanMode
User: "Add user authentication to the app"
- 确实有歧义：session vs JWT、token 存放位置、middleware 结构

User: "Redesign the data pipeline"
- 重大重构，错误方案会浪费大量工作

### 坏例子：不要使用 EnterPlanMode
User: "Add a delete button to the user profile"
- 实现路径清楚，直接做

User: "Can we work on the search feature?"
- 用户想开始做，而不是先规划

User: "Update the error handling in the API"
- 开始工作；如有需要再提具体问题

User: "Fix the typo in the README"
- 直接明了，不需要规划

## 重要说明

- 此工具需要用户批准，用户必须同意进入计划模式
`
}

export function getEnterPlanModeToolPrompt(): string {
  return process.env.USER_TYPE === 'ant'
    ? getEnterPlanModeToolPromptAnt()
    : getEnterPlanModeToolPromptExternal()
}
