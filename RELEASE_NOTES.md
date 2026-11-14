# Blo Editor 0.1.36

## 中文

- 工具栏段落菜单的快捷键保持单行显示，修复挤压换行，并调浅提示文字颜色。
- 标题列表级别按钮根据实际标题状态更新；取消某个标题的列表样式后，对应级别不再错误地保持选中。
- 清除格式支持将标题、列表、引用和代码块还原为正文，同时清除行内样式。光标未选中文字时作用于当前块，保留文字、链接、媒体、表格结构及撤销记录。
- 链接图标与说明文字支持一致的双向拖选；固定拖选起点，避免经过图标后选区被浏览器重置，防止拖选意外复制链接。
- 统一链接图标、部分文字和完整链接的选中底色高度，保留只编辑说明文字时的链接目标。
- 链接末尾统一输入普通文字，沿用所在块的段落样式；修复中文组合输入中断、重复残留及 Backspace 误删链接说明文字的问题。
- 合并链接的重复选区订阅和范围计算，共享公共判断缓存；标题存在性检查找到首个匹配即停止，减少长笔记选区变化时的开销。
- 简化链接输入边界的渲染标识，减少长段落输入时的临时字符串分配。

验证：类型检查、685 项自动化测试及生产打包通过。已在 Obsidian 的临时笔记中验证中文组合输入、取消输入、逐字删除，以及包含 1,000 个链接的长笔记拖选、全文选中和页面 DOM／文档模型一致性。

## English

- Keep paragraph-menu shortcuts on one line, fix cramped wrapping, and soften their text color.
- Reflect actual heading list formatting in level controls instead of leaving a level selected after an individual heading is disabled.
- Clear both block and inline formatting, converting headings, lists, quotes and code blocks to body text. With a caret-only selection, clear the current block while preserving content, links, media, table structure and undo history.
- Stabilize bidirectional link selection, preserve the original drag anchor across the icon, and prevent selection gestures from duplicating links through native drag and drop.
- Match the selection background height of link icons, partial labels and complete links while preserving link targets when editing label text alone.
- Type plain text at link ends using the surrounding block style. Fix interrupted Chinese IME composition, duplicate native text residue, and Backspace deleting part of the link label.
- Consolidate link selection subscriptions and range calculations, share common selection checks, and short-circuit heading existence queries in long notes.
- Replace text-sized rendering keys at link input boundaries to reduce temporary string allocation during typing.

Validation: type checking, 685 automated tests and production packaging passed. Temporary Obsidian notes covered IME updates and commits, composition cancellation, character deletion, and a 1,000-link document with forward dragging, whole-document selection and DOM/model consistency checks.
