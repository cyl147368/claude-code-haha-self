import { isEnvTruthy } from '../../utils/envUtils.js'
import { getMaxOutputLength } from '../../utils/shell/outputLimits.js'
import {
  getPowerShellEdition,
  type PowerShellEdition,
} from '../../utils/shell/powershellDetection.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { POWERSHELL_TOOL_NAME } from './toolName.js'

export function getDefaultTimeoutMs(): number {
  return getDefaultBashTimeoutMs()
}

export function getMaxTimeoutMs(): number {
  return getMaxBashTimeoutMs()
}

function getBackgroundUsageNote(): string | null {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
    return null
  }
  return `  - 你可以使用 \`run_in_background\` 参数在后台运行命令。只有在你不需要立即获得结果，并且可以稍后在命令完成时收到通知的情况下使用它。你不需要马上检查输出，完成时会收到通知。`
}

function getSleepGuidance(): string | null {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
    return null
  }
  return `  - 避免不必要的 \`Start-Sleep\` 命令：
    - 可以立即运行的命令之间不要 sleep，直接运行即可。
    - 如果命令运行时间很长，且你希望完成时收到通知，请直接使用 \`run_in_background\` 运行命令。这种情况下无需 sleep。
    - 不要在 sleep 循环中重试失败命令，请诊断根因或考虑替代方案。
    - 如果正在等待你用 \`run_in_background\` 启动的后台任务，完成时你会收到通知，不要 poll。
    - 如果必须 poll 外部进程，请先使用检查命令，而不是先 sleep。
    - 如果必须 sleep，请保持时长较短（1-5 秒），避免阻塞用户。`
}

/**
 * Version-specific syntax guidance. The model's training data covers both
 * editions but it can't tell which one it's targeting, so it either emits
 * pwsh-7 syntax on 5.1 (parser error → exit 1) or needlessly avoids && on 7.
 */
function getEditionSection(edition: PowerShellEdition | null): string {
  if (edition === 'desktop') {
    return `PowerShell edition：Windows PowerShell 5.1 (powershell.exe)
   - Pipeline chain operators \`&&\` 和 \`||\` 不可用，会导致 parser error。只有 A 成功才运行 B 时使用：\`A; if ($?) { B }\`。无条件串联使用：\`A; B\`。
   - Ternary（\`?:\`）、null-coalescing（\`??\`）和 null-conditional（\`?.\`）operators 不可用。请改用 \`if/else\` 和显式 \`$null -eq\` 检查。
   - 避免对 native executables 使用 \`2>&1\`。在 5.1 中，在 PowerShell 内重定向 native command 的 stderr 会把每一行包装成 ErrorRecord（NativeCommandError），即使 exe 返回 exit code 0，也会将 \`$?\` 设为 \`$false\`。stderr 已经会被捕获，不要重定向它。
   - 默认文件编码是 UTF-16 LE（with BOM）。写入其他工具会读取的文件时，请向 \`Out-File\`/\`Set-Content\` 传入 \`-Encoding utf8\`。
   - \`ConvertFrom-Json\` 返回 PSCustomObject，而不是 hashtable。\`-AsHashtable\` 不可用。`
  }
  if (edition === 'core') {
    return `PowerShell edition：PowerShell 7+ (pwsh)
   - Pipeline chain operators \`&&\` 和 \`||\` 可用，行为类似 bash。当 cmd2 只应在 cmd1 成功时运行，优先使用 \`cmd1 && cmd2\`，而不是 \`cmd1; cmd2\`。
   - Ternary（\`$cond ? $a : $b\`）、null-coalescing（\`??\`）和 null-conditional（\`?.\`）operators 可用。
   - 默认文件编码是无 BOM 的 UTF-8。`
  }
  // Detection not yet resolved (first prompt build before any tool call) or
  // PS not installed. Give the conservative 5.1-safe guidance.
  return `PowerShell edition：unknown。为兼容性起见，假设是 Windows PowerShell 5.1
   - 不要使用 \`&&\`、\`||\`、ternary \`?:\`、null-coalescing \`??\` 或 null-conditional \`?.\`。这些仅 PowerShell 7+ 支持，在 5.1 会 parser-error。
   - 条件串联命令：\`A; if ($?) { B }\`。无条件串联：\`A; B\`。`
}

export async function getPrompt(): Promise<string> {
  const backgroundNote = getBackgroundUsageNote()
  const sleepGuidance = getSleepGuidance()
  const edition = await getPowerShellEdition()

  return `执行给定的 PowerShell 命令，可选设置超时。工作目录会在命令之间保持；shell 状态（变量、函数）不会保持。

重要：此工具用于通过 PowerShell 执行终端操作，例如 git、npm、docker 和 PowerShell cmdlet。不要用它做文件操作（读取、写入、编辑、搜索、查找文件）；请改用专用工具。

${getEditionSection(edition)}

执行命令前，请遵循以下步骤：

1. 目录确认：
   - 如果命令会创建新目录或文件，请先使用 \`Get-ChildItem\`（或 \`ls\`）确认父目录存在且位置正确

2. 命令执行：
   - 对包含空格的文件路径，始终使用双引号包裹
   - 捕获命令输出。

PowerShell 语法说明：
   - 变量使用 $ 前缀：$myVar = "value"
   - 转义字符是 backtick（\`），不是反斜杠
   - 使用 Verb-Noun cmdlet 命名：Get-ChildItem、Set-Location、New-Item、Remove-Item
   - 常见 aliases：ls (Get-ChildItem)、cd (Set-Location)、cat (Get-Content)、rm (Remove-Item)
   - Pipe operator | 类似 bash，但传递对象而不是文本
   - 使用 Select-Object、Where-Object、ForEach-Object 做过滤和转换
   - 字符串插值："Hello $name" 或 "Hello $($obj.Property)"
   - Registry 访问使用 PSDrive prefixes：\`HKLM:\\SOFTWARE\\...\`、\`HKCU:\\...\`，不要使用原始 \`HKEY_LOCAL_MACHINE\\...\`
   - 环境变量：用 \`$env:NAME\` 读取，用 \`$env:NAME = "value"\` 设置（不要用 \`Set-Variable\` 或 bash \`export\`）
   - 调用路径中含空格的 native exe 时使用 call operator：\`& "C:\\Program Files\\App\\app.exe" arg1 arg2\`

交互式和阻塞命令（会挂住，因为此工具使用 -NonInteractive 运行）：
   - 绝不要使用 \`Read-Host\`、\`Get-Credential\`、\`Out-GridView\`、\`$Host.UI.PromptForChoice\` 或 \`pause\`
   - 破坏性 cmdlets（\`Remove-Item\`、\`Stop-Process\`、\`Clear-Content\` 等）可能要求确认。当你确实希望操作继续时，添加 \`-Confirm:$false\`。对只读/隐藏 items 使用 \`-Force\`。
   - 绝不要使用 \`git rebase -i\`、\`git add -i\` 或其他会打开交互式编辑器的命令

向 native executables 传递多行字符串（commit messages、file content）：
   - 使用单引号 here-string，使 PowerShell 不会展开其中的 \`$\` 或 backticks。结束的 \`'@\` 必须位于第 0 列（前面不能有空白），并单独成行；缩进它会导致 parse error：
<example>
git commit -m @'
Commit message here.
Second line with $literal dollar signs.
'@
</example>
   - 除非需要变量展开，否则使用 \`@'...'@\`（单引号、literal），不要使用 \`@"..."@\`（双引号、interpolated）
   - 对包含 \`-\`、\`@\` 或其他会被 PowerShell 解析为 operators 的参数，使用 stop-parsing token：\`git log --% --format=%H\`

用法说明：
  - command 参数必填。
  - 你可以指定可选超时（毫秒，最多 ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} 分钟）。如果未指定，命令会在 ${getDefaultTimeoutMs()}ms（${getDefaultTimeoutMs() / 60000} 分钟）后超时。
  - 请写清楚、简洁的命令用途描述，这会很有帮助。
  - 如果输出超过 ${getMaxOutputLength()} 个字符，返回前会被截断。
${backgroundNote ? backgroundNote + '\n' : ''}\
  - 除非用户明确要求，否则避免用 PowerShell 执行已有专用工具的任务：
    - 文件搜索：使用 ${GLOB_TOOL_NAME}（不要使用 Get-ChildItem -Recurse）
    - 内容搜索：使用 ${GREP_TOOL_NAME}（不要使用 Select-String）
    - 读取文件：使用 ${FILE_READ_TOOL_NAME}（不要使用 Get-Content）
    - 编辑文件：使用 ${FILE_EDIT_TOOL_NAME}
    - 写入文件：使用 ${FILE_WRITE_TOOL_NAME}（不要使用 Set-Content/Out-File）
    - 沟通：直接输出文本（不要使用 Write-Output/Write-Host）
  - 发出多个命令时：
    - 如果命令互相独立且可以并行，请在单条消息中发起多个 ${POWERSHELL_TOOL_NAME} 工具调用。
    - 如果命令互相依赖且必须顺序执行，请在单个 ${POWERSHELL_TOOL_NAME} 调用中串联（参见上方对应版本的串联语法）。
    - 只有在需要顺序执行且不关心前序命令是否失败时，才使用 \`;\`。
    - 不要使用换行分隔命令（引号字符串和 here-string 内的换行可以使用）
  - 不要在命令前加 \`cd\` 或 \`Set-Location\`，工作目录已经自动设置为正确的项目目录。
${sleepGuidance ? sleepGuidance + '\n' : ''}\
  - 对于 git 命令：
    - 优先创建新 commit，而不是 amend 现有 commit。
    - 运行破坏性操作前（例如 git reset --hard、git push --force、git checkout --），考虑是否有更安全的替代方式能达成同一目标。只有当破坏性操作确实是最佳方案时才使用。
    - 除非用户明确要求，否则绝不要跳过 hooks（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果 hook 失败，请调查并修复底层问题。`
}
