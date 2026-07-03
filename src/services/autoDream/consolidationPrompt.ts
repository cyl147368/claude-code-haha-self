// Extracted from dream.ts so auto-dream ships independently of KAIROS
// feature flags (dream.ts is behind a feature()-gated require).

import {
  DIR_EXISTS_GUIDANCE,
  ENTRYPOINT_NAME,
  MAX_ENTRYPOINT_LINES,
} from '../../memdir/memdir.js'

export function buildConsolidationPrompt(
  memoryRoot: string,
  transcriptDir: string,
  extra: string,
): string {
  return `# Dream：记忆整理

你正在执行一次 dream，也就是对记忆文件进行反思性整理。请把最近学到的内容综合成持久、组织良好的记忆，方便未来会话快速定位方向。

记忆目录：\`${memoryRoot}\`
${DIR_EXISTS_GUIDANCE}

会话转录：\`${transcriptDir}\`（大型 JSONL 文件；请窄范围 grep，不要读取整个文件）

---

## 阶段 1：定位

- 对记忆目录运行 \`ls\`，查看已有内容
- 读取 \`${ENTRYPOINT_NAME}\`，理解当前索引
- 浏览已有主题文件，优先改进现有文件而不是创建重复文件
- 如果存在 \`logs/\` 或 \`sessions/\` 子目录（assistant-mode 布局），查看其中最近条目

## 阶段 2：收集近期信号

寻找值得持久保存的新信息。来源大致按以下优先级：

1. **每日日志**（\`logs/YYYY/MM/YYYY-MM-DD.md\`，如果存在）：这些是追加式信息流
2. **已漂移的现有记忆**：与当前代码库观察结果矛盾的事实
3. **转录搜索**：如果需要特定上下文（例如“昨天构建失败的错误消息是什么？”），用窄关键词 grep JSONL 转录：
   \`grep -rn "<narrow term>" ${transcriptDir}/ --include="*.jsonl" | tail -50\`

不要穷尽读取转录。只查找你已经怀疑重要的内容。

## 阶段 3：整理

对于每个值得记住的事项，在记忆目录顶层写入或更新一个记忆文件。使用系统提示 auto-memory 章节中的记忆文件格式和类型约定；它是判断保存什么、如何组织、什么不要保存的权威来源。

重点：
- 把新信号合并到现有主题文件，而不是创建近似重复文件
- 把相对日期（“昨天”“上周”）转换为绝对日期，让信息在时间流逝后仍可理解
- 删除被推翻的事实；如果今天的调查证明旧记忆错误，请从源头修正

## 阶段 4：修剪和索引

更新 \`${ENTRYPOINT_NAME}\`，让它保持在 ${MAX_ENTRYPOINT_LINES} 行以内且小于约 25KB。它是**索引**，不是信息转储；每个条目应是一行且少于约 150 字符：\`- [Title](file.md) — one-line hook\`。绝不要把记忆正文直接写进去。

- 移除指向过时、错误或已被取代记忆的指针
- 降级冗长条目：如果索引行超过约 200 字符，说明它承载了应放入主题文件的内容；缩短该行并移动细节
- 添加指向新重要记忆的指针
- 解决矛盾；如果两个文件不一致，修正错误的那个

---

返回简短总结，说明你整理、更新或修剪了什么。如果没有变化（记忆已经足够紧凑），也请说明。${extra ? `\n\n## 额外上下文\n\n${extra}` : ''}`
}
