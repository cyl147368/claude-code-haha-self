import { parseFrontmatter } from '../utils/frontmatterParser.js'
import { parseSlashCommandToolsFromFrontmatter } from '../utils/markdownConfigLoader.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'
import { createMovedToPluginCommand } from './createMovedToPluginCommand.js'

const SECURITY_REVIEW_MARKDOWN = `---
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git show:*), Bash(git remote show:*), Read, Glob, Grep, LS, Task
description: 对当前分支待合入变更进行安全审查
---

你是一名资深安全工程师，正在对当前分支的变更进行聚焦的安全审查。

GIT 状态：

\`\`\`
!\`git status\`
\`\`\`

已修改文件：

\`\`\`
!\`git diff --name-only origin/HEAD...\`
\`\`\`

提交：

\`\`\`
!\`git log --no-decorate origin/HEAD...\`
\`\`\`

DIFF 内容：

\`\`\`
!\`git diff origin/HEAD...\`
\`\`\`

审查上面的完整 diff。它包含 PR 中的全部代码变更。


目标：
执行一次以安全为重点的代码审查，识别高置信度、具有真实利用潜力的安全漏洞。这不是普通代码评审；只关注此 PR 新增的安全影响。不要评论既有安全问题。

关键指令：
1. 尽量减少误报：只有在你对实际可利用性有 80% 以上把握时才报告
2. 避免噪音：跳过理论问题、风格问题或低影响发现
3. 关注影响：优先关注可能导致未授权访问、数据泄露或系统攻陷的漏洞
4. 排除项：不要报告以下类型的问题：
   - 拒绝服务（DOS）漏洞，即使它们可能导致服务中断
   - 存储在磁盘上的 secrets 或敏感数据（这些由其他流程处理）
   - 限流或资源耗尽问题

需要检查的安全类别：

**输入校验漏洞：**
- 未清理用户输入导致的 SQL injection
- 系统调用或子进程中的 command injection
- XML 解析中的 XXE injection
- 模板引擎中的 template injection
- 数据库查询中的 NoSQL injection
- 文件操作中的 path traversal

**认证与授权问题：**
- 认证绕过逻辑
- 权限提升路径
- session 管理缺陷
- JWT token 漏洞
- 授权逻辑绕过

**加密与密钥管理：**
- 硬编码 API key、密码或 token
- 弱加密算法或实现
- 不正确的 key 存储或管理
- 加密随机性问题
- 证书校验绕过

**注入与代码执行：**
- 反序列化导致的远程代码执行
- Python 中的 pickle injection
- YAML 反序列化漏洞
- 动态代码执行中的 eval injection
- Web 应用中的 XSS 漏洞（反射型、存储型、DOM 型）

**数据暴露：**
- 敏感数据日志记录或存储
- PII 处理违规
- API endpoint 数据泄露
- debug 信息暴露

补充说明：
- 即使某个问题只能从本地网络利用，它仍可能是 HIGH 严重程度问题

分析方法：

阶段 1 - 仓库上下文调研（使用文件搜索工具）：
- 识别当前使用的安全框架和库
- 查找代码库中已有的安全编码模式
- 检查既有清理和校验模式
- 理解项目的安全模型和威胁模型

阶段 2 - 对比分析：
- 将新增代码与既有安全模式对比
- 识别偏离既有安全实践的地方
- 查找不一致的安全实现
- 标记引入新攻击面的代码

阶段 3 - 漏洞评估：
- 检查每个修改文件的安全影响
- 从用户输入追踪到敏感操作的数据流
- 查找不安全跨越权限边界的位置
- 识别注入点和不安全反序列化

必需输出格式：

你必须用 markdown 输出发现。markdown 输出应包含文件、行号、严重程度、类别（例如 \`sql_injection\` 或 \`xss\`）、描述、利用场景和修复建议。

例如：

# 漏洞 1：XSS：\`foo.py:42\`

* 严重程度：High
* 描述：来自 \`username\` 参数的用户输入未经转义就直接插入 HTML，允许反射型 XSS 攻击
* 利用场景：攻击者构造 /bar?q=<script>alert(document.cookie)</script> 这样的 URL，在受害者浏览器中执行 JavaScript，从而劫持 session 或窃取数据
* 修复建议：对所有渲染到 HTML 的用户输入使用 Flask 的 escape()，或启用 Jinja2 模板自动转义

严重程度指南：
- **HIGH**：可直接利用并导致 RCE、数据泄露或认证绕过的漏洞
- **MEDIUM**：需要特定条件但影响显著的漏洞
- **LOW**：纵深防御问题或较低影响漏洞

置信度评分：
- 0.9-1.0：已识别明确利用路径，可能时已测试
- 0.8-0.9：清晰漏洞模式，且有已知利用方法
- 0.7-0.8：可疑模式，需要特定条件才能利用
- 低于 0.7：不要报告，过于猜测

最后提醒：
只关注 HIGH 和 MEDIUM 发现。相比用误报淹没报告，漏掉一些理论问题更好。每条发现都应是安全工程师会在 PR 评审中有把握提出的问题。

误报过滤：

> 你不需要运行命令复现漏洞，只需阅读代码判断它是否是真漏洞。不要使用 bash 工具，也不要写入任何文件。
>
> 硬性排除项 - 自动排除匹配以下模式的发现：
> 1. 拒绝服务（DOS）漏洞或资源耗尽攻击。
> 2. 存储在磁盘上的 secrets 或凭据，只要它们在其他方面已被保护。
> 3. 限流问题或服务过载场景。
> 4. 内存消耗或 CPU 耗尽问题。
> 5. 非安全关键字段缺少输入校验，且没有已证明的安全影响。
> 6. GitHub Action workflow 中的输入清理问题，除非它明确可由不受信任输入触发。
> 7. 缺少加固措施。代码不要求实现所有安全最佳实践，只报告具体漏洞。
> 8. 理论而非实际的 race condition 或 timing attack。只有在 race condition 具体造成问题时才报告。
> 9. 过时第三方库相关漏洞。这些由单独流程管理，不应在这里报告。
> 10. Rust 中不可能出现 buffer overflow 或 use-after-free 等内存安全问题。不要报告 Rust 或其他内存安全语言中的内存安全问题。
> 11. 只用于单元测试或只在运行测试时使用的文件。
> 12. 日志伪造问题。把未清理的用户输入输出到日志不构成漏洞。
> 13. 只能控制 path 的 SSRF。只有能控制 host 或 protocol 时，SSRF 才值得关注。
> 14. 在 AI system prompt 中包含用户可控内容不是漏洞。
> 15. Regex injection。把不受信任内容注入 regex 不构成漏洞。
> 16. Regex DOS 问题。
> 17. 不安全文档。不要报告 markdown 等文档文件中的发现。
> 18. 缺少审计日志不是漏洞。
>
> 先例 -
> 1. 明文记录高价值 secrets 是漏洞。记录 URL 默认视为安全。
> 2. UUID 可以假设不可猜测，不需要额外校验。
> 3. 环境变量和 CLI flag 是可信值。在安全环境中，攻击者通常无法修改它们。任何依赖控制环境变量的攻击都是无效的。
> 4. 内存泄漏或文件描述符泄漏等资源管理问题无效。
> 5. tabnabbing、XS-Leaks、prototype pollution、open redirect 等细微或低影响 Web 漏洞，除非置信度极高，否则不要报告。
> 6. React 和 Angular 通常能抵御 XSS。这些框架不需要额外清理或转义用户输入，除非代码使用 dangerouslySetInnerHTML、bypassSecurityTrustHtml 或类似机制。除非使用了不安全机制，否则不要在 React、Angular 组件或 tsx 文件中报告 XSS。
> 7. 大多数 github action workflow 漏洞在实践中不可利用。验证 github action workflow 漏洞前，确保它具体且有非常明确的攻击路径。
> 8. 客户端 JS/TS 代码缺少权限检查或认证不是漏洞。客户端代码不可信，也不需要实现这些检查；它们应由服务端处理。所有把不受信任数据发送到后端的流程同理，后端负责校验和清理输入。
> 9. 只有 MEDIUM 发现明显且具体时才包含它。
> 10. ipython notebooks（*.ipynb 文件）中的大多数漏洞在实践中不可利用。验证 notebook 漏洞前，确保它具体，并且存在由不受信任输入触发的非常明确攻击路径。
> 11. 记录非 PII 数据不是漏洞，即使该数据可能敏感。只有日志暴露 secrets、密码或个人身份信息（PII）等敏感信息时，才报告日志漏洞。
> 12. shell 脚本中的 command injection 通常在实践中不可利用，因为 shell 脚本通常不会带着不受信任的用户输入运行。只有存在具体且非常明确的不受信任输入攻击路径时，才报告 shell 脚本中的 command injection。
>
> 信号质量标准 - 对剩余发现进行评估：
> 1. 是否存在具体、可利用且攻击路径清晰的漏洞？
> 2. 这是真实安全风险，还是理论最佳实践？
> 3. 是否有具体代码位置和复现步骤？
> 4. 该发现对安全团队是否可执行？
>
> 对每条发现分配 1-10 的置信度：
> - 1-3：低置信度，可能是误报或噪音
> - 4-6：中等置信度，需要调查
> - 7-10：高置信度，可能是真漏洞

开始分析：

现在开始分析。分 3 步完成：

1. 使用子任务识别漏洞。使用仓库探索工具理解代码库上下文，然后分析 PR 变更的安全影响。在此子任务 prompt 中包含上面的全部内容。
2. 然后针对上一步识别出的每个漏洞，创建一个新的子任务过滤误报。并行启动这些子任务。在这些子任务 prompt 中包含 "误报过滤" 的全部说明。
3. 过滤掉子任务报告中置信度低于 8 的所有漏洞。

你的最终回复必须只包含 markdown 报告，不要包含其他内容。`

export default createMovedToPluginCommand({
  name: 'security-review',
  description: '对当前分支待合入变更进行安全审查',
  progressMessage: '正在分析代码变更中的安全风险',
  pluginName: 'security-review',
  pluginCommand: 'security-review',
  async getPromptWhileMarketplaceIsPrivate(_args, context) {
    // 解析 markdown frontmatter。
    const parsed = parseFrontmatter(SECURITY_REVIEW_MARKDOWN)

    // 从 frontmatter 解析允许使用的工具。
    const allowedTools = parseSlashCommandToolsFromFrontmatter(
      parsed.frontmatter['allowed-tools'],
    )

    // 执行 prompt 中嵌入的 shell 命令。
    const processedContent = await executeShellCommandsInPrompt(
      parsed.content,
      {
        ...context,
        getAppState() {
          const appState = context.getAppState()
          return {
            ...appState,
            toolPermissionContext: {
              ...appState.toolPermissionContext,
              alwaysAllowRules: {
                ...appState.toolPermissionContext.alwaysAllowRules,
                command: allowedTools,
              },
            },
          }
        },
      },
      'security-review',
    )

    return [
      {
        type: 'text',
        text: processedContent,
      },
    ]
  },
})
