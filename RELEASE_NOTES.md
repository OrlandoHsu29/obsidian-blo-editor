# Blo Editor 0.2.3

## 中文

- 完成父任务后，子项继承半透明和删除线样式；保留各子任务自己的勾选状态。
- Shift 点击图片、画板或 PDF 时，连续选择中间的文字和媒体；Ctrl/Cmd 点击仍可单独多选图片。正文拖到媒体即可完整选中，删除与撤销保留正确边界。
- 修复媒体边缘拖选的选区跳动，统一处理表格上下空白边缘，避免误选整表或从整表退回首格。
- 消除跨块拖入表格时原生文字高亮的短暂闪烁。选区包含表格外内容时，仅保留高亮，隐藏对齐工具栏与行列控件；表内选择和文字编辑保留原有操作。
- 修复演示控制栏内边距及控件间空白处光标消失的问题。
- 设置页新增 GitHub 项目入口，调整右侧操作控件的垂直对齐；更新中英文 README、演示模式及任务清单截图。

- 引用竖线跟随缩进，引用子项不再打断列表层级竖线；保留原有 Markdown 深度数据。
- Backspace 先移除列表标记，再移除引用；空行继续退缩进时只改变当前块，子项保持原位。Shift+Tab 仍带子树一起退缩进。
- 只读预览隐藏画板编辑按钮，表格使用轻量边缘渐隐；修复卡片图标样式将画板 SVG 缩成小图标的问题。

验证：类型检查、838 项自动化测试及生产打包通过。实际 Obsidian 检查覆盖正文与标题拖入表格、表格上下边缘、跨表格与全文选中、单元格编辑、媒体范围选择、任务继承样式及演示控制栏光标。

## English

- Inherit dimmed, struck-through styling from completed parent tasks while preserving each child's own checkbox state.
- Shift-click images, drawings and PDFs to select a continuous range including intervening text and media. Ctrl/Cmd-click retains individual image selection. Preserve complete media boundaries during dragging, deletion and undo.
- Stabilize media-edge dragging and resolve both vertical table gutters consistently, preventing accidental whole-table selection or a jump back to the first cell.
- Prevent the native text-selection flash when dragging into a table from outside. Hide alignment and row/column controls for cross-block selections while retaining cell highlights and normal in-table editing.
- Restore the normal cursor over presentation toolbar padding and gaps between controls.
- Add a GitHub project link to settings, center action controls vertically, and refresh both READMEs with presentation and nested-task screenshots.

- Align quote borders with indentation and retain list guides through quoted child blocks without rewriting saved depth metadata.
- Backspace removes list markers, then quotes; outdenting an empty block changes that block alone. Shift+Tab continues to outdent its subtree.
- Hide drawing edit controls in read-only previews, simplify table overflow fades, and prevent card icon styles from shrinking drawing SVGs.

Validation: type checking, 838 automated tests and production packaging passed. Live Obsidian checks covered text/heading-to-table dragging, table edges, cross-table and document selection, cell editing, media ranges, inherited task styling and presentation toolbar cursors.

## 安装 / Installation

将 `blo-editor-0.2.3.zip` 中的 `blo-editor/` 解压到笔记库的 `.obsidian/plugins/`，升级时保留 `data.json`。需要桌面版 Obsidian 1.8.7+。

Extract `blo-editor/` from `blo-editor-0.2.3.zip` into your vault's `.obsidian/plugins/`, preserving `data.json`. Requires desktop Obsidian 1.8.7+.

[完整版本差异 / Full comparison](https://github.com/OrlandoHsu29/obsidian-blo-editor/compare/v0.2.1...v0.2.3)
