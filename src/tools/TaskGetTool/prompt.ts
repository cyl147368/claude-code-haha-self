export const DESCRIPTION = '按 ID 从任务列表获取任务'

export const PROMPT = `使用此工具按 ID 从任务列表中获取某个任务。

## 何时使用此工具

- 开始处理任务前，需要完整描述和上下文时
- 需要理解任务依赖（它阻塞了什么、它被什么阻塞）时
- 被分配任务后，需要获取完整需求时

## 输出

返回完整任务详情：
- **subject**：任务标题
- **description**：详细需求和上下文
- **status**：'pending'、'in_progress' 或 'completed'
- **blocks**：正在等待此任务完成的任务
- **blockedBy**：必须先完成后此任务才能开始的任务

## 提示

- 获取任务后，开始工作前先确认 blockedBy 列表为空。
- 使用 TaskList 以摘要形式查看所有任务。
`
