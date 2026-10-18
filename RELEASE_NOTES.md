# Blo Editor 0.1.5 — 多级编号、表格编辑与语雀导入改进

## 中文

- **层级与编号**：标题有序列表支持 `1.2.3`，结合标题级别与块缩进计算，编号同步显示在原生大纲；改进继续编号的作用范围。
- **块编辑**：拖动参考线显示缩进刻度，父子块一起移动；改进段落样式重复切换、分割线选中及表格／代码块边界处的光标和删除行为。
- **表格交互**：支持单元格区域、整行和整列选择；悬浮工具栏提供对齐、标题行和标题列，改进新增行列、删除提示与默认标题样式。
- **复制粘贴**：保留网页富文本格式，向其他编辑器复制时提供 HTML 与纯文本；修复语雀颜色标签与加粗、下划线、列表、行内代码组合的解析及保存重开问题。
- **主题适配**：导入颜色映射到固定色板，近黑／近白文字与中性底色跟随深浅主题。
- **使用体验**：改进斜杠菜单的中英文、拼音首字母检索与定位，统一代码字体；README 增加深浅色整体预览及四项独立折叠功能截图。

安装包：`blo-editor-0.1.5.zip`。解压后将 `blo-editor` 目录放入笔记库的 `.obsidian/plugins/`，更新时保留已有 `data.json`，然后重新加载插件或重启 Obsidian。

要求桌面版 Obsidian **1.8.7 或更新版本**。已被旧版保存成转义星号的内容，需要从原始来源重新粘贴；本版本不会批量改写已有笔记。

## English

- **Structure and numbering:** hierarchical ordered headings display `1.2.3` using heading levels and indentation, with cached numbers in the native outline and improved continuation boundaries.
- **Block editing:** indentation guides show numbered levels while dragging parent/child blocks. Improve paragraph-style toggles, divider selection, and cursor/deletion behavior at table and code-block boundaries.
- **Tables:** select cell ranges, rows, or columns; use floating alignment/header controls, improved insertion/deletion feedback, and configurable default headers.
- **Clipboard:** preserve web HTML on paste and provide portable HTML plus plain text on copy. Fix Yuque font tags combined with bold, underline, lists, and inline code, including save/reopen formatting.
- **Themes:** map imported colors to the fixed palette; near-black/white text and neutral backgrounds follow the theme.
- **Usability:** improve Chinese, English, and pinyin-initial slash search, menu placement, and code typography. Refresh both READMEs with light/dark previews and four separate feature screenshots.

Install `blo-editor-0.1.5.zip` by extracting its `blo-editor` directory into your vault's `.obsidian/plugins/`. Preserve an existing `data.json` when upgrading, then reload the plugin or restart Obsidian.

Requires desktop Obsidian **1.8.7 or later**. Content already saved as escaped asterisks by an older version needs to be pasted again from its original source; existing notes are not rewritten in bulk.
