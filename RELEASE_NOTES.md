# Blo Editor 0.1.37

## 中文

- 修复表格向上拖选后横向移动鼠标时选中行闪烁的问题，避免链接图标拖选与表格选区互相覆盖。
- PDF 使用独立块嵌入，支持按页面比例缩放、原生工具栏和滚动翻页、双击打开。工具栏溢出时提供双向阴影和细横向滚动条；页面使用自动隐藏的覆盖式竖向滚动条。
- PDF 与画板共享缩放调度，拖动期间冻结 PDF 视口并暂停渲染，结束后统一计算和过渡显示；下方文字随块尺寸移动。复用媒体缩放控件，合并每帧预览更新并保留整次操作的撤销记录。
- 下载并嵌入正文中的图片、PDF 等媒体链接时，将前后文字拆成独立段落；保留表格单元格中的行内媒体和已有笔记兼容性。
- 图片、画板和 PDF 等独立块右侧输入文字时另起文本段落，移除转成行内图片的入口；保留旧行内图片转为独立块的能力。
- 修复右侧光标处拼音预编辑字母下移，以及首次确认输入后新增行被滚动到页面上方的问题。
- 清理废弃控件和重复蒙版样式，防止过期的 PDF 加载任务在缩放期间重新启动渲染。

验证：类型检查、737 项自动化测试及生产打包通过。在 Obsidian 临时笔记中模拟原生输入法预编辑与确认，核对字母和光标同一行、首次输入的滚动位置及边缘最小滚动。

## English

- Fix selected table rows flickering during horizontal pointer movement after an upward drag by keeping link-icon correction separate from table selection.
- Embed PDFs as standalone blocks with proportional resizing, native toolbar and continuous page scrolling, and double-click opening. Add directional toolbar overflow shadows, a thin horizontal toolbar scrollbar, and an auto-hiding overlay page scrollbar.
- Share resize scheduling with drawings. Freeze PDF viewport geometry and pause rendering during gestures, then fit and reveal the result after resizing settles while following text moves with the block. Reuse media controls, coalesce preview updates per frame, and preserve undo history.
- Split surrounding text into separate paragraphs when downloading and embedding media links such as images and PDFs. Preserve inline media inside table cells and compatibility with existing notes.
- Start a new paragraph when typing at the right boundary of standalone images, drawings and PDFs. Remove the block-to-inline image action while retaining conversion of legacy inline images to blocks.
- Keep uncommitted IME letters aligned with the boundary caret and prevent the first committed input from scrolling its new paragraph toward the top of the viewport.
- Remove obsolete controls and duplicate mask styles, and prevent stale PDF loading tasks from restarting rendering during resizing.

Validation: type checking, 737 automated tests and production packaging passed. Temporary Obsidian notes covered native IME preedit and commit, caret alignment, first-input scroll stability, and minimal scrolling at the viewport edge.

## 安装 / Installation

将 `blo-editor-0.1.37.zip` 中的 `blo-editor/` 解压到笔记库的 `.obsidian/plugins/`，升级时保留原有 `data.json`。需要桌面版 Obsidian 1.8.7+。

Extract `blo-editor/` from `blo-editor-0.1.37.zip` into your vault's `.obsidian/plugins/`, preserving an existing `data.json`. Requires desktop Obsidian 1.8.7+.

[完整版本差异 / Full comparison](https://github.com/OrlandoHsu29/obsidian-blo-editor/compare/v0.1.36...v0.1.37)
