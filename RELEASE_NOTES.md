# Blo Editor 0.1.27 — 光标边界与拖选修复

## 中文

- 修复行内代码左右两侧的光标定位，支持分别停留在代码内外并输入对应样式的内容。
- 修复从行内代码外侧，以及图片、画板、代码块、表格和块公式右侧边界开始拖选时，选区丢失或被折叠的问题。
- 文档末尾空白区域支持拖选；改进拖选期间的选区锚点、工具栏命中和自动滚动处理。
- 优化选中样式，裁剪媒体的空占位节点，避免下方突出；移除画板及公式预览文字的原生选区色块，保留块选中外框。

安装：下载 blo-editor-0.1.27.zip，将解压后的 blo-editor 文件夹放入笔记库的 .obsidian/plugins/。更新时保留 data.json，然后重新加载插件或重启 Obsidian。

要求桌面版 Obsidian **1.8.7 或更新版本**。也提供单独的 main.js、styles.css 和 manifest.json。

## English

- Fix caret placement at both ends of inline code, with distinct positions inside and outside the code for correctly styled input.
- Preserve drag selections starting outside inline code or at the right boundary of images, drawings, code blocks, tables and block formulas.
- Support selection dragging from the blank area at the end of a document; improve selection anchors, toolbar hit testing and scrolling during boundary drags.
- Clip empty media placeholders to prevent protruding artifacts. Remove native text-selection highlights from drawing and formula previews while retaining block selection outlines.

Install blo-editor-0.1.27.zip by placing the extracted blo-editor folder in your vault's .obsidian/plugins/. Preserve data.json when updating, then reload the plugin or restart Obsidian.

Requires desktop Obsidian **1.8.7 or later**. Standalone main.js, styles.css and manifest.json assets are also provided.
