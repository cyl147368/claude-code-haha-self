// External stub for ExitPlanModeTool prompt - excludes Ant-only allowedPrompts section

// Hardcoded to avoid relative import issues in stub
const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const EXIT_PLAN_MODE_V2_TOOL_PROMPT = `当你处于计划模式、已经把计划写入计划文件，并准备请求用户批准时使用此工具。

## 此工具如何工作
- 你应该已经把计划写入计划模式系统消息指定的计划文件
- 此工具不接收计划内容作为参数；它会从你写入的文件读取计划
- 此工具只是表示你已完成规划，并准备让用户审查和批准
- 用户审查时会看到你的计划文件内容

## 何时使用此工具
重要：只有当任务需要规划“需要写代码的实现步骤”时，才使用此工具。对于收集信息、搜索文件、读取文件或一般理解代码库的研究任务，不要使用此工具。

## 使用前
确保你的计划完整且无歧义：
- 如果你对需求或方案还有未解决问题，请先在早期阶段使用 ${ASK_USER_QUESTION_TOOL_NAME}
- 一旦计划最终确定，使用此工具请求批准

**重要：** 不要使用 ${ASK_USER_QUESTION_TOOL_NAME} 询问 "Is this plan okay?" 或 "Should I proceed?"，这正是此工具的作用。ExitPlanMode 本身就会请求用户批准你的计划。

## 示例

1. 初始任务："Search for and understand the implementation of vim mode in the codebase"。不要使用 exit plan mode tool，因为你不是在规划实现步骤。
2. 初始任务："Help me implement yank mode for vim"。完成任务实现步骤规划后，使用 exit plan mode tool。
3. 初始任务："Add a new feature to handle user authentication"。如果不确定 auth 方法（OAuth、JWT 等），先使用 ${ASK_USER_QUESTION_TOOL_NAME}，澄清方案后再使用 exit plan mode tool。
`
