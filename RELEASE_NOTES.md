# Blo Editor 0.1.28

## 中文

- 新增 H1～H4 标题列表，支持无序（井号）和有序（数字）两种方式，可分别启用各标题级别。同一篇笔记保持一种标题列表方式，工具栏和快捷键遵守当前选择。
- 完善标题编号：未编号的中间标题会阻断上级编号继承；子标题保持独立编号。Backspace 可直接清除标题列表样式。
- 统一 Markdown、富文本和 PDF 导出：不导出装饰井号，保留实际数字编号及正文列表结构。
- 修复段落合并时空列表标记丢失的问题；调整任务列表命名、工具栏顺序、列表对齐与引用线位置。
- 块按钮提示延迟显示在下方，复用工具栏的统一提示逻辑。
- 复用编辑事务及指针拖动逻辑，清理未使用代码，改善图片缩放和弹窗拖动的撤销与资源释放。
- 切换行内图片与单独一行时保留当前尺寸，不再自动套用缩小预设；未记录尺寸的图片也可正常切换。
- 标题有序列表编号使用完全不透明的主题强调色。
- 修复引用开头按 Backspace 时跨块合并、引用外壳残留及连续按键可能删除上一行末尾字符的问题；首次取消一层引用，保留链接、文字和撤销记录。
- 重新截取 README 的深浅色总览、表格选区、窄窗口表格、工具栏溢出和导出选项，展示当前界面样式。
- 子标题有序列表使用小写字母 a、b、c…，超过 z 后接 aa、ab…；使用独立子标题图标，段落菜单位置保留在标题 4 后。导出保留字母前缀，Markdown 使用加粗正文呈现子标题。

验证：类型检查、105 项自动化测试及生产打包通过；已验证 Obsidian 内的标题列表、快捷键、撤销、保存与导出交互，并用临时笔记验证引用取消、链接合并、子标题字母编号及 Markdown 保存重开。

## English

- Added heading lists for H1–H4 with unordered hash prefixes or ordered numeric prefixes and independent heading-level controls. Toolbar actions and shortcuts follow the selected document-wide mode.
- Improved numbering across unnumbered intermediate headings, kept subtitle numbering independent, and made Backspace remove heading list formatting directly.
- Unified Markdown, rich-text and PDF exports: omit decorative hashes while preserving actual numbering and body lists.
- Fixed empty list markers disappearing when merging paragraphs; refined task-list labels, toolbar order, list alignment and quote borders.
- Delayed block-handle tooltips below their controls and reused the shared toolbar tooltip behavior.
- Shared editor transactions and pointer-drag handling, removed unused code, and improved resize/drag undo and cleanup.
- Preserve current image dimensions when switching between inline and block layouts, including images without recorded dimensions.
- Render ordered heading numbers with the fully opaque theme accent color.
- Fix Backspace at the start of a quote merging across blocks, leaving an empty quote, or deleting the previous line's last character on repeated presses. The first press now removes one quote level while preserving links, text and undo history.
- Refresh the README screenshots for light/dark previews, table selection, narrow tables, toolbar overflow and export options using the current interface.
- Use lowercase a, b, c… numbering for subtitles, continuing with aa, ab… after z. Add a dedicated subtitle icon while keeping its paragraph-menu position after Heading 4. Exports retain the letter prefixes; Markdown renders subtitles as bold paragraphs.

Validation: type checking, 105 automated tests and production packaging passed. Heading lists, shortcuts, undo, persistence and exports were verified in Obsidian, with temporary-note checks for quote removal, link merging, subtitle letters and saved/reopened Markdown.
