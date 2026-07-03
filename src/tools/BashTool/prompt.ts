import { feature } from 'bun:bundle'
import { prependBullets } from '../../constants/prompts.js'
import { getAttributionTexts } from '../../utils/attribution.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { shouldIncludeGitInstructions } from '../../utils/gitSettings.js'
import { getClaudeTempDir } from '../../utils/permissions/filesystem.js'
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import {
  getUndercoverInstructions,
  isUndercover,
} from '../../utils/undercover.js'
import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { TodoWriteTool } from '../TodoWriteTool/TodoWriteTool.js'
import { BASH_TOOL_NAME } from './toolName.js'

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
  return "你可以使用 `run_in_background` 参数在后台运行命令。只有在你不需要立即获得结果，并且可以稍后在命令完成时收到通知的情况下使用它。你不需要马上检查输出，完成时会收到通知。使用此参数时，不需要在命令末尾使用 '&'。"
}

function getCommitAndPRInstructions(): string {
  // Defense-in-depth: undercover instructions must survive even if the user
  // has disabled git instructions entirely. Attribution stripping and model-ID
  // hiding are mechanical and work regardless, but the explicit "don't blow
  // your cover" instructions are the last line of defense against the model
  // volunteering an internal codename in a commit message.
  const undercoverSection =
    process.env.USER_TYPE === 'ant' && isUndercover()
      ? getUndercoverInstructions() + '\n'
      : ''

  if (!shouldIncludeGitInstructions()) return undercoverSection

  // For ant users, use the short version pointing to skills
  if (process.env.USER_TYPE === 'ant') {
    const skillsSection = !isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)
      ? `对于 git commit 和 pull request，请使用 \`/commit\` 和 \`/commit-push-pr\` skills：
- \`/commit\`：用已暂存更改创建 git commit
- \`/commit-push-pr\`：commit、push 并创建 pull request

这些 skills 会处理 git 安全协议、正确的 commit message 格式以及 PR 创建。

创建 pull request 前，运行 \`/simplify\` 审查你的更改，然后做端到端测试（例如对交互式功能使用 \`/tmux\`）。

`
      : ''
    return `${undercoverSection}# Git 操作

${skillsSection}重要：除非用户明确要求，否则绝不要跳过 hooks（--no-verify、--no-gpg-sign 等）。

对于其他 GitHub 相关任务（包括 issues、checks、releases），通过 Bash 工具使用 gh 命令。如果给定 Github URL，请使用 gh 命令获取所需信息。

# 其他常见操作
- 查看 Github PR 评论：gh api repos/foo/bar/pulls/123/comments`
  }

  // For external users, include full inline instructions
  const { commit: commitAttribution, pr: prAttribution } = getAttributionTexts()

  return `# 使用 git 提交更改

仅在用户要求时创建 commit。如果不清楚，先询问。当用户要求你创建新的 git commit 时，请仔细遵循这些步骤：

你可以在一次回复中调用多个工具。当需要多项独立信息且所有命令都可能成功时，并行运行多个工具调用以获得最佳性能。下面编号步骤会说明哪些命令应并行批处理。

Git 安全协议：
- 绝不要更新 git config
- 除非用户明确要求，否则绝不要运行破坏性 git 命令（push --force、reset --hard、checkout .、restore .、clean -f、branch -D）。未经授权的破坏性操作没有帮助，且可能导致工作丢失，因此只有在收到直接指令时才运行这些命令
- 除非用户明确要求，否则绝不要跳过 hooks（--no-verify、--no-gpg-sign 等）
- 绝不要对 main/master 执行 force push；如果用户要求这样做，请警告用户
- 关键：除非用户明确要求 git amend，否则始终创建新的 commits，而不是 amend。pre-commit hook 失败时，commit 并没有发生，因此 --amend 会修改上一个 commit，可能破坏工作或丢失之前的更改。hook 失败后，请修复问题、重新 stage，并创建新的 commit
- 暂存文件时，优先按名称添加具体文件，而不是使用 "git add -A" 或 "git add ."，后者可能意外包含敏感文件（.env、credentials）或大型二进制文件
- 除非用户明确要求，否则绝不要 commit 更改。只在明确要求时 commit 非常重要，否则用户会觉得你过于主动

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令：
  - 运行 git status 查看所有 untracked files。重要：绝不要使用 -uall flag，因为它可能在大型仓库中导致内存问题。
  - 运行 git diff 查看将被提交的 staged 和 unstaged changes。
  - 运行 git log 查看最近 commit messages，以便遵循此仓库的 commit message 风格。
2. 分析所有 staged changes（包括之前 staged 和新添加的），并起草 commit message：
  - 总结更改性质（例如新功能、现有功能增强、bug fix、refactoring、test、docs 等）。确保 message 准确反映更改及目的（即 "add" 表示全新功能，"update" 表示现有功能增强，"fix" 表示 bug fix 等）。
  - 不要 commit 可能包含 secrets 的文件（.env、credentials.json 等）。如果用户明确要求 commit 这些文件，请警告用户。
  - 起草简洁（1-2 句）的 commit message，关注 "why" 而不是 "what"
  - 确保它准确反映更改及目的
3. 并行运行以下命令：
   - 将相关 untracked files 添加到 staging area。
   - 使用 message 创建 commit${commitAttribution ? `，并以以下内容结尾：\n   ${commitAttribution}` : '。'}
   - commit 完成后运行 git status 验证成功。
   注意：git status 依赖 commit 完成，因此应在 commit 后顺序运行。
4. 如果 commit 因 pre-commit hook 失败：修复问题并创建新的 commit

重要说明：
- 除 git bash 命令外，绝不要运行额外命令读取或探索代码
- 绝不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 除非用户明确要求，否则不要 push 到 remote repository
- 重要：绝不要使用带 -i flag 的 git 命令（例如 git rebase -i 或 git add -i），因为它们需要不支持的交互式输入。
- 重要：不要在 git rebase 命令中使用 --no-edit，因为 --no-edit 不是 git rebase 的有效选项。
- 如果没有可提交更改（即没有 untracked files 且没有 modifications），不要创建空 commit
- 为了确保格式良好，始终通过 HEREDOC 传递 commit message，如下例：
<example>
git commit -m "$(cat <<'EOF'
   Commit message here.${commitAttribution ? `\n\n   ${commitAttribution}` : ''}
   EOF
   )"
</example>

# 创建 pull requests
对于所有 GitHub 相关任务（包括 issues、pull requests、checks、releases），通过 Bash 工具使用 gh 命令。如果给定 Github URL，请使用 gh 命令获取所需信息。

重要：当用户要求你创建 pull request 时，请仔细遵循以下步骤：

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令，以理解当前分支从 main 分支分叉以来的状态：
   - 运行 git status 查看所有 untracked files（绝不要使用 -uall flag）
   - 运行 git diff 查看将被提交的 staged 和 unstaged changes
   - 检查当前分支是否 tracking remote branch，且是否与 remote 同步，以判断是否需要 push 到 remote
   - 运行 git log 命令和 \`git diff [base-branch]...HEAD\`，理解当前分支完整 commit history（从它与 base branch 分叉开始）
2. 分析将包含在 pull request 中的所有更改，确保查看所有相关 commits（不只是最新 commit，而是 pull request 中包含的所有 commits！！！），并起草 pull request title 和 summary：
   - PR title 保持简短（少于 70 字符）
   - 细节放在 description/body 中，不要放在 title 中
3. 并行运行以下命令：
   - 如有需要，创建新分支
   - 如有需要，用 -u flag push 到 remote
   - 使用以下格式通过 gh pr create 创建 PR。使用 HEREDOC 传递 body，以确保格式正确。
<example>
gh pr create --title "the pr title" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Test plan
[Bulleted markdown checklist of TODOs for testing the pull request...]${prAttribution ? `\n\n${prAttribution}` : ''}
EOF
)"
</example>

重要：
- 不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 完成后返回 PR URL，方便用户查看

# 其他常见操作
- 查看 Github PR 评论：gh api repos/foo/bar/pulls/123/comments`
}

// SandboxManager merges config from multiple sources (settings layers, defaults,
// CLI flags) without deduping, so paths like ~/.cache appear 3× in allowOnly.
// Dedup here before inlining into the prompt — affects only what the model sees,
// not sandbox enforcement. Saves ~150-200 tokens/request when sandbox is enabled.
function dedup<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) return arr
  return [...new Set(arr)]
}

function getSimpleSandboxSection(): string {
  if (!SandboxManager.isSandboxingEnabled()) {
    return ''
  }

  const fsReadConfig = SandboxManager.getFsReadConfig()
  const fsWriteConfig = SandboxManager.getFsWriteConfig()
  const networkRestrictionConfig = SandboxManager.getNetworkRestrictionConfig()
  const allowUnixSockets = SandboxManager.getAllowUnixSockets()
  const ignoreViolations = SandboxManager.getIgnoreViolations()
  const allowUnsandboxedCommands =
    SandboxManager.areUnsandboxedCommandsAllowed()

  // Replace the per-UID temp dir literal (e.g. /private/tmp/claude-1001/) with
  // "$TMPDIR" so the prompt is identical across users — avoids busting the
  // cross-user global prompt cache. The sandbox already sets $TMPDIR at runtime.
  const claudeTempDir = getClaudeTempDir()
  const normalizeAllowOnly = (paths: string[]): string[] =>
    [...new Set(paths)].map(p => (p === claudeTempDir ? '$TMPDIR' : p))

  const filesystemConfig = {
    read: {
      denyOnly: dedup(fsReadConfig.denyOnly),
      ...(fsReadConfig.allowWithinDeny && {
        allowWithinDeny: dedup(fsReadConfig.allowWithinDeny),
      }),
    },
    write: {
      allowOnly: normalizeAllowOnly(fsWriteConfig.allowOnly),
      denyWithinAllow: dedup(fsWriteConfig.denyWithinAllow),
    },
  }

  const networkConfig = {
    ...(networkRestrictionConfig?.allowedHosts && {
      allowedHosts: dedup(networkRestrictionConfig.allowedHosts),
    }),
    ...(networkRestrictionConfig?.deniedHosts && {
      deniedHosts: dedup(networkRestrictionConfig.deniedHosts),
    }),
    ...(allowUnixSockets && { allowUnixSockets: dedup(allowUnixSockets) }),
  }

  const restrictionsLines = []
  if (Object.keys(filesystemConfig).length > 0) {
    restrictionsLines.push(`Filesystem: ${jsonStringify(filesystemConfig)}`)
  }
  if (Object.keys(networkConfig).length > 0) {
    restrictionsLines.push(`Network: ${jsonStringify(networkConfig)}`)
  }
  if (ignoreViolations) {
    restrictionsLines.push(
      `Ignored violations: ${jsonStringify(ignoreViolations)}`,
    )
  }

  const sandboxOverrideItems: Array<string | string[]> =
    allowUnsandboxedCommands
      ? [
          '默认应始终在 sandbox 内运行命令。除非满足以下条件，否则不要尝试设置 `dangerouslyDisableSandbox: true`：',
          [
            '用户明确要求你绕过 sandbox',
            '某个具体命令刚刚失败，并且你看到证据表明失败由 sandbox 限制造成。注意：命令可能因许多与 sandbox 无关的原因失败（缺少文件、参数错误、网络问题等）。',
          ],
          'sandbox 导致失败的证据包括：',
          [
            '文件/网络操作出现 "Operation not permitted" 错误',
            '访问允许目录之外的特定路径被拒绝',
            '连接非白名单 hosts 的网络连接失败',
            'Unix socket 连接错误',
          ],
          '当你看到 sandbox 导致失败的证据时：',
          [
            '立即使用 `dangerouslyDisableSandbox: true` 重试（不要询问，直接执行）',
            '简短说明可能是哪项 sandbox 限制造成失败。务必提到用户可以使用 `/sandbox` 命令管理限制。',
            '这会提示用户授权',
          ],
          '对每条使用 `dangerouslyDisableSandbox: true` 执行的命令都单独看待。即使你最近使用过该设置运行命令，未来命令仍应默认在 sandbox 内运行。',
          '不要建议将 ~/.bashrc、~/.zshrc、~/.ssh/* 或 credential files 等敏感路径加入 sandbox allowlist。',
        ]
      : [
          '所有命令都必须在 sandbox mode 下运行，`dangerouslyDisableSandbox` 参数已被策略禁用。',
          '任何情况下命令都不能在 sandbox 外运行。',
          '如果命令因 sandbox 限制失败，请与用户协作调整 sandbox 设置。',
        ]

  const items: Array<string | string[]> = [
    ...sandboxOverrideItems,
    '临时文件始终使用 `$TMPDIR` 环境变量。在 sandbox mode 下，TMPDIR 会自动设置为正确的 sandbox 可写目录。不要直接使用 `/tmp`，请改用 `$TMPDIR`。',
  ]

  return [
    '',
    '## 命令 sandbox',
    '默认情况下，你的命令会在 sandbox 中运行。该 sandbox 控制命令在没有显式 override 时可以访问或修改哪些目录和网络 hosts。',
    '',
    'sandbox 具有以下限制：',
    restrictionsLines.join('\n'),
    '',
    ...prependBullets(items),
  ].join('\n')
}

export function getSimplePrompt(): string {
  // Ant-native builds alias find/grep to embedded bfs/ugrep in Claude's shell,
  // so we don't steer away from them (and Glob/Grep tools are removed).
  const embedded = hasEmbeddedSearchTools()

  const toolPreferenceItems = [
    ...(embedded
      ? []
      : [
          `文件搜索：使用 ${GLOB_TOOL_NAME}（不要使用 find 或 ls）`,
          `内容搜索：使用 ${GREP_TOOL_NAME}（不要使用 grep 或 rg）`,
        ]),
    `读取文件：使用 ${FILE_READ_TOOL_NAME}（不要使用 cat/head/tail）`,
    `编辑文件：使用 ${FILE_EDIT_TOOL_NAME}（不要使用 sed/awk）`,
    `写入文件：使用 ${FILE_WRITE_TOOL_NAME}（不要使用 echo >/cat <<EOF）`,
    '沟通：直接输出文本（不要使用 echo/printf）',
  ]

  const avoidCommands = embedded
    ? '`cat`, `head`, `tail`, `sed`, `awk`, or `echo`'
    : '`find`, `grep`, `cat`, `head`, `tail`, `sed`, `awk`, or `echo`'

  const multipleCommandsSubitems = [
    `如果命令互相独立且可以并行，请在单条消息中发起多个 ${BASH_TOOL_NAME} 工具调用。例如：如果需要运行 "git status" 和 "git diff"，请在单条消息中并行发送两个 ${BASH_TOOL_NAME} 工具调用。`,
    `如果命令互相依赖且必须顺序执行，请使用单个 ${BASH_TOOL_NAME} 调用并用 '&&' 串联。`,
    "只有在需要顺序执行且不关心前序命令是否失败时，才使用 ';'。",
    '不要使用换行分隔命令（引号字符串中的换行可以使用）。',
  ]

  const gitSubitems = [
    '优先创建新 commit，而不是 amend 现有 commit。',
    '运行破坏性操作前（例如 git reset --hard、git push --force、git checkout --），考虑是否有更安全的替代方式能达成同一目标。只有当破坏性操作确实是最佳方案时才使用。',
    '除非用户明确要求，否则绝不要跳过 hooks（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果 hook 失败，请调查并修复底层问题。',
  ]

  const sleepSubitems = [
    '可以立即运行的命令之间不要 sleep，直接运行即可。',
    ...(feature('MONITOR_TOOL')
      ? [
          '使用 Monitor 工具从后台进程流式接收事件（每行 stdout 都是一个通知）。对于一次性 "wait until done"，请改用带 run_in_background 的 Bash。',
        ]
      : []),
    '如果命令运行时间很长，且你希望完成时收到通知，请使用 `run_in_background`。无需 sleep。',
    '不要在 sleep 循环中重试失败命令，请诊断根因。',
    '如果正在等待你用 `run_in_background` 启动的后台任务，完成时你会收到通知，不要 poll。',
    ...(feature('MONITOR_TOOL')
      ? [
          '`sleep N` 作为首个命令且 N ≥ 2 会被阻止。如果你需要延迟（rate limiting、有意节奏控制），请保持在 2 秒以内。',
        ]
      : [
          '如果必须 poll 外部进程，请使用检查命令（例如 `gh run view`），而不是先 sleep。',
          '如果必须 sleep，请保持时长较短（1-5 秒），避免阻塞用户。',
        ]),
  ]
  const backgroundNote = getBackgroundUsageNote()

  const instructionItems: Array<string | string[]> = [
    '如果命令会创建新目录或文件，请先使用此工具运行 `ls`，确认父目录存在且位置正确。',
    '命令中包含空格的文件路径始终用双引号包裹（例如 cd "path with spaces/file.txt"）',
    '整个会话中尽量通过绝对路径保持当前工作目录，并避免使用 `cd`。如果用户明确要求，可以使用 `cd`。',
    `你可以指定可选超时（毫秒，最多 ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} 分钟）。默认情况下，命令会在 ${getDefaultTimeoutMs()}ms（${getDefaultTimeoutMs() / 60000} 分钟）后超时。`,
    ...(backgroundNote !== null ? [backgroundNote] : []),
    '发出多个命令时：',
    multipleCommandsSubitems,
    '对于 git 命令：',
    gitSubitems,
    '避免不必要的 `sleep` 命令：',
    sleepSubitems,
    ...(embedded
      ? [
          // bfs (which backs `find`) uses Oniguruma for -regex, which picks the
          // FIRST matching alternative (leftmost-first), unlike GNU find's
          // POSIX leftmost-longest. This silently drops matches when a shorter
          // alternative is a prefix of a longer one.
          "使用带 alternation 的 `find -regex` 时，把最长的 alternative 放在前面。例如使用 `'.*\\.\\(tsx\\|ts\\)'`，不要使用 `'.*\\.\\(ts\\|tsx\\)'`，后者会静默跳过 `.tsx` 文件。",
        ]
      : []),
  ]

  return [
    '执行给定的 bash 命令并返回输出。',
    '',
    '工作目录会在命令之间保持，但 shell 状态不会保持。shell 环境会从用户的 profile（bash 或 zsh）初始化。',
    '',
    `重要：避免用此工具运行 ${avoidCommands} 命令，除非用户明确要求，或你已确认专用工具无法完成任务。请改用合适的专用工具，因为这样能为用户提供更好的体验：`,
    '',
    ...prependBullets(toolPreferenceItems),
    `虽然 ${BASH_TOOL_NAME} 工具也能完成类似事情，但最好使用内置工具，因为它们能提供更好的用户体验，也更便于审查工具调用和授权。`,
    '',
    '# 使用说明',
    ...prependBullets(instructionItems),
    getSimpleSandboxSection(),
    ...(getCommitAndPRInstructions() ? ['', getCommitAndPRInstructions()] : []),
  ].join('\n')
}
