import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'

export const PROMPT = `使用此工具为当前编码会话创建和管理结构化任务列表。这有助于跟踪进度、组织复杂任务，并向用户展示你做事周全。
它也能帮助用户了解当前任务和整体请求的进展。

## 何时使用此工具
在以下场景主动使用此工具：

1. 复杂多步骤任务：任务需要 3 个或更多明确步骤或操作
2. 非平凡且复杂的任务：需要仔细规划或多项操作
3. 用户明确要求 todo list：用户直接要求你使用任务列表
4. 用户提供多个任务：用户给出一组待办事项（编号或逗号分隔）
5. 收到新指令后：立即把用户需求记录为 todos
6. 开始处理任务时：开始前先把任务标记为 in_progress。理想情况下，同一时间只应有一个 todo 处于 in_progress
7. 完成任务后：标记为 completed，并添加实现中发现的后续任务

## 何时不要使用此工具

以下情况跳过此工具：
1. 只有一个直接明了的任务
2. 任务很琐碎，跟踪它没有组织收益
3. 任务可在少于 3 个简单步骤内完成
4. 任务纯粹是对话或信息咨询

注意：如果只有一个琐碎任务，不应使用此工具。此时直接完成任务更好。

## 应使用 Todo List 的示例

<example>
User: I want to add a dark mode toggle to the application settings. Make sure you run the tests and build when you're done!
Assistant: *创建包含以下项目的 todo list：*
1. Creating dark mode toggle component in Settings page
2. Adding dark mode state management (context/store)
3. Implementing CSS-in-JS styles for dark theme
4. Updating existing components to support theme switching
5. Running tests and build process, addressing any failures or errors that occur
*开始处理第一个任务*

<reasoning>
助手使用 todo list 的原因：
1. 添加 dark mode 是多步骤功能，需要 UI、状态管理和样式修改
2. 用户明确要求之后运行测试和 build
3. 助手推断 tests 和 build 需要通过，因此加入 "Ensure tests and build succeed" 作为最终任务
</reasoning>
</example>

<example>
User: Help me rename the function getCwd to getCurrentWorkingDirectory across my project
Assistant: *使用 grep 或搜索工具定位代码库中所有 getCwd 实例*
我找到了分布在 8 个文件中的 15 个 'getCwd' 实例。
*为每个需要更新的文件创建具体 todo 项*

<reasoning>
助手使用 todo list 的原因：
1. 助手先搜索以理解任务范围
2. 发现多个文件中有多个出现位置后，判断这是包含多个步骤的复杂任务
3. todo list 有助于确保每个实例都被跟踪并系统更新
4. 这种方式可以避免遗漏，并保持代码一致性
</reasoning>
</example>

<example>
User: I need to implement these features for my e-commerce site: user registration, product catalog, shopping cart, and checkout flow.
Assistant: *根据项目架构创建 todo list，把每个 feature 拆成具体任务*
我们先从 user registration 开始。这会涉及创建 database models、API endpoints，以及与现有 authentication system 集成的 frontend forms。

<reasoning>
助手使用 todo list 的原因：
1. 用户提供了多个复杂功能，且以逗号分隔
2. todo list 有助于把这些大型功能组织成可管理任务
3. 这种方式可以跟踪整个实现过程的进展
</reasoning>
</example>

<example>
User: Can you help optimize my React application? It's rendering slowly and has performance issues.
Assistant: *审查组件结构、render patterns、状态管理和数据获取*
分析代码库后，我识别出几个性能问题。
*创建 todo list，项目例如：1) Implementing memoization for expensive calculations in ProductList, 2) Adding virtualization for long lists in Dashboard, 3) Optimizing image loading in Gallery component, 4) Fixing state update loops in ShoppingCart, 5) Reviewing bundle size and implementing code splitting*
我们先从 ProductList 组件中昂贵计算的 memoization 开始。

<reasoning>
助手使用 todo list 的原因：
1. 助手先检查代码库，以识别具体性能问题
2. 基于分析，识别出多个优化机会
3. 性能优化是需要多个步骤的非平凡任务
4. todo list 有助于有条理地跟踪不同组件中的改进
5. 这种系统化方式能确保所有性能瓶颈都被处理
</reasoning>
</example>

## 不应使用 Todo List 的示例

<example>
User: How do I print 'Hello World' in Python?
Assistant: 在 Python 中，可以用这段简单代码打印 "Hello World"：

python
print("Hello World")

执行后会在控制台输出文本 "Hello World"。

<reasoning>
助手没有使用 todo list，因为这是一个可以一步完成的单一琐碎任务。不需要为这种直接请求跟踪多个任务或步骤。
</reasoning>
</example>

<example>
User: What does the git status command do?
Assistant: git status 命令会显示当前 working directory 和 staging area 的状态。它会展示哪些更改已 staged、哪些未 staged，以及哪些文件尚未被 Git 跟踪。这是在提交前理解仓库当前状态的基础命令。

<reasoning>
助手没有使用 todo list，因为这是一个信息咨询请求，没有实际编码任务要完成。用户只是要求解释，而不是要求助手执行多个步骤或任务。
</reasoning>
</example>

<example>
User: Can you add a comment to the calculateTotal function to explain what it does?
Assistant: 好的，我来给 calculateTotal 函数添加说明注释。
* 使用 ${FILE_EDIT_TOOL_NAME} 工具给 calculateTotal 函数添加注释 *

<reasoning>
助手没有使用 todo list，因为这是一个单一、直接、局限在一个位置的任务。添加注释不需要跟踪多个步骤或系统化组织。
</reasoning>
</example>

<example>
User: Run npm install for me and tell me what happens.
Assistant: 我来为你运行 npm install 命令。

*执行：npm install*

命令成功完成。输出如下：
[Output of npm install command]

所有依赖已根据 package.json 安装完成。

<reasoning>
助手没有使用 todo list，因为这是一个单次命令执行，结果立即可得。没有多个步骤需要跟踪或组织，因此任务列表对此类直接任务没有必要。
</reasoning>
</example>

## 任务状态和管理

1. **任务状态**：使用这些状态跟踪进度：
   - pending：任务尚未开始
   - in_progress：当前正在处理（同一时间限制为一个任务）
   - completed：任务已成功完成

   **重要**：任务描述必须有两种形式：
   - content：描述需要做什么的祈使式（例如 "Run tests"、"Build the project"）
   - activeForm：执行过程中显示的现在进行式（例如 "Running tests"、"Building the project"）

2. **任务管理**：
   - 工作过程中实时更新任务状态
   - 完成后立即标记任务完成（不要批量攒着一起完成）
   - 任意时刻必须恰好有一个任务处于 in_progress（不能更少，也不能更多）
   - 开始新任务前，先完成当前任务
   - 将不再相关的任务从列表中完全移除

3. **任务完成要求**：
   - 只有在完全完成任务后，才将任务标记为 completed
   - 如果遇到错误、阻塞或无法完成，请保持任务为 in_progress
   - 被阻塞时，创建一个新任务说明需要解决什么
   - 以下情况绝不要将任务标记为 completed：
     - 测试失败
     - 实现只是部分完成
     - 存在未解决错误
     - 找不到必要文件或依赖

4. **任务拆分**：
   - 创建具体、可执行的项目
   - 把复杂任务拆成更小、可管理的步骤
   - 使用清晰、描述性的任务名
   - 始终同时提供两种形式：
     - content: "Fix authentication bug"
     - activeForm: "Fixing authentication bug"

拿不准时，使用此工具。主动管理任务体现了专注，也能确保你成功完成所有要求。
`

export const DESCRIPTION =
  '更新当前会话的 todo list。用于主动且频繁地跟踪进度和待办任务。确保始终至少有一个任务处于 in_progress。每个任务始终同时提供 content（祈使式）和 activeForm（现在进行式）。'
