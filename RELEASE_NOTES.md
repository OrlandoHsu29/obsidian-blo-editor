# Blo Editor 0.1.38

## 中文

- 修复正文统一字距覆盖 MathJax 运算符间距的问题，恢复公式符号两侧的正常留白。
- 修复从库外路径打开 README 等含图片笔记时，动态资源地址触发图片反复挂载、正文闪烁和持续重排的问题；相同图片尺寸不再重复更新状态。
- 正文粘贴到已有样式的标题、列表时保留目标行样式；局部复制标题或列表文字时不携带块样式，保留文字自身的行内格式，完整块复制仍保留块样式。
- 勾选任务框时退出插件管理的旧表格单元格选中状态，避免重新进入编辑或滚回表格；选中的表格标题行、标题列使用更深底色。
- 禁用工具栏按钮仍可悬停查看功能与快捷键，点击和悬停不会执行禁用操作；工具栏提示延迟调整为 600 毫秒。
- PDF 与 HTML 共用清理后的渲染快照，保留列表层级竖线、画板、公式和代码高亮，修复导出编号间距并去除编辑控件。
- 导出时独立生成嵌入 PDF 当前页的静态预览，兼容尚未在屏幕中绘制的 PDF；不改变原笔记选区、页面位置和阅读器状态。
- 云文档富文本将无法通用内嵌的 PDF、画板等附件转为链接，避免失效图片；Markdown 继续优先通用语法。
- 精简中英文 README，新增五张真实功能截图及「月面邮局」示例笔记、可编辑画板和 PDF；安装包包含示例文件。

验证：类型检查、752 项自动化测试、生产打包通过。已在 Obsidian 中验证四种导出、实际 PDF 生成、复制粘贴与撤销，以及库外 README 的图片稳定性。HTML/PDF 中的嵌入 PDF 为静态页面；云文档能保留的格式以目标应用支持为准。

## English

- Preserve MathJax's native operator spacing instead of overriding it with body-text letter spacing.
- Fix repeated image remounts, flashing content and continuous reflow when external file adapters return changing resource URLs. Avoid redundant updates for unchanged natural image dimensions.
- Preserve an existing heading/list style when pasting body text. Partial copies carry text and inline formatting without heading/list styles; complete block copies retain their structure.
- Leave the previous plugin-managed table cell selection when toggling a task, preventing accidental cell editing or scrolling back to the table. Distinguish selected header rows and columns with deeper shading.
- Keep functional and shortcut tooltips available on disabled toolbar controls without activating them. Increase toolbar tooltip delay to 600 ms.
- Share cleaned rendered snapshots between HTML and PDF, retaining hierarchy guides, drawings, formulas and syntax highlighting while removing editor controls and preserving number spacing.
- Independently render the current page of embedded PDFs for static export, including offscreen readers, without changing the source selection, scroll position or reader state.
- Export unsupported PDF/drawing embeds as links in cloud-document rich text rather than broken images. Keep Markdown output focused on portable syntax.
- Rewrite both READMEs with five real screenshots and a Moonpost demo note, editable drawing and PDF, also included in the installation package.

Validation: type checking, 752 automated tests and production packaging passed. Live Obsidian checks covered all four export formats, actual PDF generation, copy/paste and undo, and external README image stability. Embedded PDFs become static pages in HTML/PDF; cloud-document formatting depends on the receiving application.

## 安装 / Installation

将 `blo-editor-0.1.38.zip` 中的 `blo-editor/` 解压到笔记库的 `.obsidian/plugins/`，升级时保留原有 `data.json`。需要桌面版 Obsidian 1.8.7+。

Extract `blo-editor/` from `blo-editor-0.1.38.zip` into your vault's `.obsidian/plugins/`, preserving an existing `data.json`. Requires desktop Obsidian 1.8.7+.

[完整版本差异 / Full comparison](https://github.com/OrlandoHsu29/obsidian-blo-editor/compare/v0.1.37...v0.1.38)
