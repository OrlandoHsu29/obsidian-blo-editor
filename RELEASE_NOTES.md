# Blo Editor 0.1.15 — PDF 导出、图片本地化与工具栏配置

## 中文

- **独立 PDF 导出**：从笔记右上角、命令面板或文件浏览器右键菜单导出，支持纸张、横向、页边距、标题和页码，保留表格、代码高亮、图片与画板预览。未打开的笔记使用临时只读预览，结束后返回原标签页；修复大文档的 ERR_INVALID_URL 错误。
- **网络图片本地化**：导入 Markdown 或语雀 `<img>` 图片后，下载到设置的附件目录并改用本地预览，保留图片宽度；下载失败保留原链接，代码中的标签保持原样。
- **工具栏配置**：一行图标配合复选框控制按钮显示，并即时同步到打开的标签页。段落样式、清除格式、撤销、重做、字体颜色和查找／替换固定显示，对应配置保持勾选、置灰且不可修改；图标与实际工具栏统一。
- **斜杠菜单**：新增默认 3×3 表格、复选框、链接和图片；链接与图片打开工具栏同款插入菜单，隐藏工具栏按钮不影响使用，支持中英文、别名及拼音首字母。
- **解析与设置**：修复普通 Markdown 与块元数据混排时元数据被显示成 HTML 的情况，保留代码和表格元数据兼容；改进编辑范围与已有标签页设置，更新中英文 README 排版。

安装：下载 `blo-editor-0.1.15.zip`，将解压后的 `blo-editor` 文件夹放入笔记库的 `.obsidian/plugins/`。更新时保留已有 `data.json`，然后重新加载插件或重启 Obsidian。

要求桌面版 Obsidian **1.8.7 或更新版本**；画板功能需另行启用 Excalidraw。也提供单独的 `main.js`、`styles.css` 和 `manifest.json`。

## English

- **Independent PDF export:** export from the note header, command palette, or file explorer context menu. Choose paper size, landscape orientation, margins, title, and page numbers while preserving tables, syntax highlighting, images, and drawing previews. Temporary read-only previews return to the original tab. Fix ERR_INVALID_URL on large documents.
- **Local image imports:** download Markdown and Yuque HTML images to the configured attachment folder and preserve their widths. Failed downloads retain the original link; code examples stay literal.
- **Toolbar preferences:** use shared icons and checkboxes to control visibility across open tabs. Paragraph style, clear formatting, undo, redo, text color, and find/replace stay visible, with checked, gray, disabled settings.
- **Slash commands:** add 3×3 tables, checkboxes, links, and images. Link/image commands reuse the toolbar dialogs, including when toolbar buttons are hidden. Support bilingual names, aliases, and pinyin initials.
- **Parsing and settings:** recover block metadata mixed with ordinary Markdown while preserving code and table metadata. Improve editing scope, restored-tab settings, and the bilingual README layout.

Install `blo-editor-0.1.15.zip` by placing the extracted `blo-editor` directory in your vault's `.obsidian/plugins/`. Preserve an existing `data.json`, then reload the plugin or restart Obsidian.

Requires desktop Obsidian **1.8.7 or later**. Drawing features require the optional Excalidraw plugin. Standalone `main.js`, `styles.css`, and `manifest.json` assets are also included.
