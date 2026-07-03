export const DESCRIPTION =
  '替换 Jupyter notebook 中特定 cell 的内容。'
export const PROMPT = `用新的 source 完全替换 Jupyter notebook（.ipynb 文件）中特定 cell 的内容。Jupyter notebook 是结合代码、文本和可视化的交互式文档，常用于数据分析和科学计算。notebook_path 参数必须是绝对路径，不能是相对路径。cell_number 从 0 开始计数。使用 edit_mode=insert 可在 cell_number 指定的索引处添加新 cell。使用 edit_mode=delete 可删除 cell_number 指定的 cell。`
