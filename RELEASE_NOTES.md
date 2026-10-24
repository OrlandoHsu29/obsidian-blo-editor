# Blo Editor 0.1.17 — 可选插件集成与画板引用替换

## 中文

- **可选插件集成**：设置中新增图片查看器和画板开关，开启后自动安装并启用 Image Toolkit 或 Excalidraw，已有安装直接复用。关闭只停用 Blo 集成，保留依赖插件、附件及已有预览。
- **画板另存与引用替换**：新增“另存后替换当前引用”，默认关闭；勾选后仅更新对应的画板引用，保留尺寸和原文件，支持撤销与重做。内嵌预览和画板窗口均可使用。
- **媒体交互修复**：来源弹窗跟随对象滚动及缩放，打开画板窗口或另存为时自动隐藏；改进悬浮返回按钮和图片工具条的显示，修复查看器工具条背景未覆盖全部按钮的问题。
- **表格选区**：多格选择改为单元格背景高亮，避免跨行选择时误高亮未选中格内的链接，并在多格选择时关闭链接信息框。

安装：下载 blo-editor-0.1.17.zip，将解压后的 blo-editor 文件夹放入笔记库的 .obsidian/plugins/。更新时保留 data.json，然后重新加载插件或重启 Obsidian。

要求桌面版 Obsidian **1.8.7 或更新版本**。单独的 main.js、styles.css 和 manifest.json 也可下载。

## English

- **Optional integrations:** enable the image viewer or drawings in settings to install and activate Image Toolkit or Excalidraw, reusing existing installations. Disabling a Blo integration keeps its dependency plugin, attachments and existing previews.
- **Save drawing copies and replace references:** optionally replace only the originating embed after saving a copy. The option defaults off, preserves dimensions and the original file, and supports undo/redo from both embedded previews and drawing windows.
- **Media interaction fixes:** source cards follow scrolling and image/drawing resizing, and close when opening the drawing window or Save As. Improve floating return controls and media toolbars, including the viewer background that previously failed to contain every button.
- **Table selection:** highlight selected cell backgrounds, prevent links in other cells from appearing selected across rows, and close link cards during multi-cell selection.

Install blo-editor-0.1.17.zip by placing the extracted blo-editor folder in your vault's .obsidian/plugins/. Preserve data.json when updating, then reload the plugin or restart Obsidian.

Requires desktop Obsidian **1.8.7 or later**. Standalone main.js, styles.css and manifest.json assets are also provided.
