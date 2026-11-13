# Changelog

## 0.1.33 — 2026-11-13

### 中文

- 有序列表在正文、标题和子标题之间切换时保留编号；子标题序号使用统一的紫色。
- 链接文字支持直接定位光标和编辑。选满文字后输入会保留链接地址；点击图标或拖选经过图标才能选中整条链接，剪切不再残留图标。
- 所有链接统一显示图标；仅图标的空白链接可编辑，并保留第一次退格选中、第二次删除的行为。多个空格统一保存为一个空白标签。
- 链接弹窗增加靠右的浅灰提示，显示文字留空时使用链接地址；开启自动标题时优先获取网页标题。
- 新增默认开启的「Alt+A 分级选择」：先选当前块及子块，已完整选中时再按选中全文。可在设置中即时关闭。
- 保留此前列表、任务框和引用的视觉位置，缩窄左侧遮挡区域，让拖动与折叠按钮完整显示；主窗口与 Glimmer Memo 保持正文位置及右边距不变。

### English

- Preserve ordered-list numbering when switching body, heading and subtitle styles; use the same accent color for subtitle numbers.
- Edit link text directly with a visible caret. Replacing the entire label preserves its destination; click or drag across the icon to select and cut the complete link without leaving an orphan icon.
- Show a consistent icon on all links. Editable icon-only blank links retain two-step Backspace selection/deletion, and whitespace-only labels persist as one blank label.
- Add right-aligned display-text hints to link dialogs. Empty labels use the link address, or a fetched page title when automatic titles are enabled.
- Add **Progressive selection with Alt+A**, enabled by default: select the current block and its children, then select the document on the next press. Disable it immediately in settings.
- Preserve the established visual alignment of lists, task boxes and quotes. Expose clipped left-side drag/fold controls without moving note content or its right edge in the main editor and Glimmer Memo.

Validation: type checking, 442 automated tests and production packaging passed. Live Obsidian checks covered block/document selection, the setting toggle, link-label replacement, full-link cutting, hint alignment and main/memo control visibility.

Installation: extract `blo-editor-0.1.33.zip` into the vault's `.obsidian/plugins/`, preserving an existing `data.json`. Requires desktop Obsidian 1.8.7 or later.

## 0.1.32 — 2026-11-13

### 中文

- 移除设置中的工具栏图标显隐配置及相关订阅、图标渲染与样式；旧的隐藏配置不再影响工具栏，窄窗口继续自动收纳。
- 主窗口和 Glimmer Memo 共用工具优先级与收纳逻辑。主窗口先从右到左收纳画板、缩进、分割线、行内公式等非必要工具，全部收纳后再从右到左收纳必要工具，保留主栏原有顺序。
- Glimmer Memo 保留精简主栏，其余工具放进「三点」菜单；窗口继续变窄时，放不下的必要工具也收进同一菜单。按分组整理分割线，避免遗漏或重复工具。
- 展开栏沿用主栏的图标、按钮尺寸、间距、圆角和阴影，不再套用速记弹窗的小尺寸缩放。主栏与展开栏共用居中的短细分割线，深浅色保持一致。
- 工具栏按布局像素计算宽度，修正缩放窗口中的收纳预算；保留已有过渡动画和减少动态效果设置。
- 工具栏和列表标记、块柄在尺寸观察回调中完成测量，减少额外等待下一帧；避免屏幕外块和未显示块柄进入测量队列，移除重复的窗口级测量扫描，保留内容与字体变化后的定位更新。

### English

- Remove manual toolbar visibility settings and their subscriptions, settings icon rendering and styles. Legacy hidden-button preferences no longer hide tools; narrow windows still collect overflowing controls automatically.
- Share overflow priorities between the main editor and Glimmer Memo. Collect optional tools from right to left before collecting primary tools, preserving the order of controls that remain visible.
- Keep Glimmer Memo's compact primary row and expose all additional tools through the three-dot menu. Narrower windows collect primary controls into the same menu without dropping or duplicating tools.
- Match expanded toolbar buttons, icons, spacing, corners and shadows to the main row instead of applying the smaller quick-memo dialog scale. Reuse centered, short dividers in both rows and themes.
- Fit controls using layout pixels in scaled windows while preserving toolbar transitions and reduced-motion support.
- Measure toolbar fit and list-marker/block-handle positions directly in resize observation callbacks. Skip offscreen blocks and inactive handles, remove duplicate window-wide measurement sweeps, and retain alignment updates after content and font changes.

Validation: type checking, 394 automated tests and production packaging passed.
Live checks covered priority overflow while narrowing and widening the editor,
menu completeness, matching toolbar metrics in both themes, and the same
559-block note in the main editor and Glimmer Memo. Native memo resizing caused
no repeated settings writes or ResizeObserver loop errors. Occasional native
window long frames remain; these changes do not claim to eliminate all stutter.

Installation: extract `blo-editor-0.1.32.zip` into the vault's
`.obsidian/plugins/`, preserving an existing `data.json`. Requires desktop
Obsidian 1.8.7 or later.

## 0.1.31 — 2026-11-13

### 中文

- 随插件提供完整的 Blo 笔记 Skill，在设置中查看或复制安装／更新提示词；路径随实际安装位置生成。可手动在编辑范围生成或更新 AGENTS.md，仅维护 Blo 规则段，保留已有个人规则。
- 块柄菜单新增「复制块链接」，为正文、列表、引用、表格和代码等块保存原生 Obsidian 块 ID；支持跨笔记跳转与目标块预览，拆分、粘贴和转换时保护引用标识。
- 粘贴表格时从单格或选区左上角逐格填入，按需扩展行列，保留目标区域外的内容并支持整次撤销；兼容 Blo、HTML、Markdown 和制表符表格。标题行、标题列默认居中。
- 工具栏隐藏图标与收纳时增加过渡动画，支持减少动态效果设置，结束或卸载时清理动画与临时节点；动画期间避免重复计算溢出范围。
- 修复 Mermaid 滚动条误触代码编辑、绘制完成后仍显示加载状态、预览切换源码时页面跳动，以及过期异步绘制影响新图表的问题。
- 修复链接预览在小数尺寸和缩放下反复变化、闪烁抖动的问题；折叠列表末尾回车在隐藏子块之后新建同级块，空正文退格返回可见父项，保留撤销／重做。
- 编辑回调与保存检查共享未变化内容的 Markdown 转换结果；切换笔记时仅在初始化或遗漏的后台变更后扫描远程图片，保留下载重试逻辑。

### English

- Bundle the complete Blo note-writing Skill, with settings to preview or copy an installation/update prompt using the actual plugin path. Generate directory AGENTS.md rules on demand while preserving existing personal instructions.
- Add **Copy block link** to block menus using native Obsidian block IDs, with cross-note navigation and targeted previews. Preserve IDs through splitting, pasting and conversion.
- Paste table grids from the selected cell or selection's top-left corner, expanding rows and columns as needed and supporting one-step undo. Support Blo, HTML, Markdown and tab-separated tables. Center header rows and columns by default.
- Animate toolbar visibility and overflow transitions, respect reduced motion, clean up animation resources, and skip redundant overflow measurements during width animations.
- Fix Mermaid scrollbar clicks entering source editing, stuck loading indicators, viewport jumps when entering source, and stale asynchronous renders affecting newer diagrams.
- Stabilize link previews at fractional sizes and zoom levels. Keep hidden list descendants folded when pressing Enter or Backspace, with undo/redo preserved.
- Share Markdown serialization across unchanged-content callbacks and saves; avoid repeated full-document image scans on tab activation while recovering background changes and interrupted downloads.

Validation: type checking, 381 automated tests and production packaging passed.
Live Obsidian checks used a 2,000-paragraph note to verify toolbar animation,
overflow resizing, unchanged Markdown, and cleanup after transitions.

Installation: extract `blo-editor-0.1.31.zip` into the vault's
`.obsidian/plugins/`, preserving an existing `data.json`. Requires desktop
Obsidian 1.8.7 or later.

## 0.1.21 — 2026-10-26

- Connect to Glimmer Memo using its renamed plugin ID, window marker and GitHub
  repository, avoiding the unrelated Flash Memo plugin in the community directory.
- Guide manual installation of the complete Glimmer Memo ZIP, detect an installed
  but disabled plugin, and offer to enable it before turning on the integration.
- Identify quick memo windows by their explicit marker instead of their file path;
  adopt newly attached windows and respect integration changes during pending saves
  without stealing focus from another tab.
- Press Backspace on an indented empty text block to remove one indentation level
  before deleting the line, with undo/redo and the same subtree rules as Shift+Tab.
- Refresh both READMEs with optional integration setup, slash-command search and
  empty-block indentation shortcuts.

## 0.1.20 — 2026-10-26

- Show quick memo notes from Glimmer Memo with Blo Editor: hide the duplicated
  file name, keep a compact toolbar at the top, save before the panel hides, and
  focus the editor so typing starts immediately. Turning the integration off
  returns the memo note to the native editor.
- Enable optional integrations automatically when Image Toolkit, Excalidraw or
  Glimmer Memo is already enabled, and remember switches turned off manually.
- Fix focus, the slash menu, table menus, link/image dialogs and find highlights
  inside popout windows by measuring against the editor's own window.
- Fix the blank editor caused by conditional block quote hooks when the
  selection or focus changed.
- Keep every enabled toolbar button on one row without a horizontal scrollbar,
  always show table/link/image, and separate clear formatting from undo.

## 0.1.18 — 2026-10-24

- Drag multiple selected blocks together, preserving child blocks and undo/redo.
  Show rounded block highlights and fade the original blocks during dragging.
- Use cell background highlights for tables selected together with other blocks,
  without text-selection backgrounds or highlighted borders.
- Avoid synthetic empty header rows when pasting tables from Yuque and other
  HTML editors, while retaining genuine empty rows and header formatting.
- Preserve explicitly typed ordered-list numbers and create a separate paragraph
  when pressing Enter at the end of a numbered heading. Split numbered headings
  and body text into separate list items on Enter within text, preserving formatting,
  indentation and undo/redo; unify list spacing and refine quote indentation.
- Fix moving the caret outside trailing inline code with arrow keys or deletion.
- Show the opening note's name while loading.

## 0.1.17 — 2026-10-24

- Add optional image viewer and drawing integrations that install and enable their
  dependencies on demand, without uninstalling them when an integration is disabled.
- Optionally replace the originating drawing reference after saving a copy;
  preserve dimensions and original files, with undo/redo and drawing-window support.
- Keep source cards aligned during resizing and dismiss them before drawing actions.
- Improve floating return controls and media toolbar theme styling and sizing.
- Refine table cell selection and link-card behavior across rows.
- Enlarge the document title spacing and allow deleting an empty first paragraph.
- Keep floating block controls behind the editor toolbar and menus above it.

## 0.1.16 — 2026-10-24

- Auto-scroll at editor edges during block dragging, preserving subtree moves and undo.
- Show source details and reference actions for media outside the attachment folder;
  dismiss link cards on page scroll until the object is selected again.
- Embed existing vault media without copying files; resolve vault paths and links,
  and open internal links with Ctrl/Cmd-click in editing mode or a click in reading mode.
- Add resizable video blocks with native controls, atomic selection, proportional
  dimensions, presets, persistence and undo/redo.
- Save drawing copies from embedded previews and full drawing views, using
  vault-relative paths and collision-safe filenames.
- Unify optional embedded attachment cleanup. Protect files outside the attachment
  folder and shared references; retain trash recovery and undo preview refresh.
  The new setting defaults off, including when migrating old per-type toggles.
- Insert a leading body paragraph on Enter at the end of the title; restore
  existing Blo-formatted notes outside the automatic editing scope while
  preserving an explicit choice to use the native editor.

## 0.1.15 — 2026-10-20

- Export rendered notes directly to PDF with paper size, landscape orientation,
  margins, title, and page numbers. Keep code highlighting, tables, images, and
  drawing previews. Export from the header, command palette, or file explorer
  context menu; temporary read-only previews return to the original tab.
  Large documents no longer fail with ERR_INVALID_URL.
- Download imported Markdown and Yuque HTML images into the configured attachment
  folder. Preserve image widths, reuse downloads, keep failed links, and leave
  code examples literal. Bind async saves to the original note and folder.
- Configure toolbar visibility with shared icons and checkboxes. Keep paragraph
  style, clear formatting, undo, redo, text color, and find/replace always visible;
  fixed settings stay checked, gray, and disabled. Changes apply across open tabs.
- Add slash commands for 3×3 tables, checkboxes, links, and images. Reuse the
  toolbar insertion dialogs even when their buttons are hidden, with bilingual,
  alias, and pinyin-initial search.
- Improve editing-folder scope, restored-tab behavior, and grouped settings.
- Recover block metadata mixed with ordinary Markdown, isolate invalid metadata,
  and preserve literal code and existing table metadata.
- Refresh the bilingual README header and document PDF export and image imports.

## 0.1.10 — 2026-10-19

- Add optional Excalidraw integration with content-fitting inline previews,
  proportional resizing, atomic selection, external caret navigation, and a
  save-and-return action from full-size drawing tabs.
- Store images and drawings in one configurable vault-relative attachment folder.
  Save pasted/dropped images, audio, video, PDFs, and other files before inserting
  their previews or links at the original position.
- Add separate, disabled-by-default image/drawing attachment cleanup settings.
  Protect shared references, move unused files to trash, and restore files and
  previews on undo without requiring the image to be selected.
- Separate table cell selection from editing: click to select, Enter/Space or
  double-click to edit, type to replace, Tab to move, and Shift+arrows to extend
  a complete rectangle with the same text highlighting as mouse selection.
  Clear cell contents without removing cells; preserve row/column deletion controls.
- Improve code indentation, searchable language selection, block boundary
  navigation, image handles and spacing, and clicking below the document to
  focus or create a trailing empty paragraph.
- Continue same-level ordered numbering across intervening content, retaining
  manual restarts and hierarchical heading numbers in the outline.
- Update both READMEs with drawing/attachment workflows and a public drawing
  example and screenshot. Excalidraw remains an optional dependency.

## 0.1.5 — 2026-10-18

- Add hierarchical ordered headings with cached numbering in the native outline.
- Show indentation levels while dragging blocks; improve paragraph-style toggles,
  list numbering boundaries, divider selection, and table/code boundary navigation.
- Improve table cell/row/column selection, floating formatting controls, insertion,
  deletion previews, and default header styles.
- Preserve web HTML formatting on paste and export portable rich HTML on copy.
- Improve Yuque imports combining font colors, bold, underline, lists, and inline
  code; preserve formatting after saving and reopening, and keep fenced code literal.
- Map imported colors to the editor palette; use theme colors for near-black/white
  text and neutral backgrounds.
- Improve slash-command search and menu placement, and use regular Consolas-first
  code typography without extra bold syntax tokens.
- Refresh bilingual documentation with two overview previews, four separate
  feature screenshots, and public sample notes.

## 0.1.0 — 2026-10-17

- Introduce Blo Editor, a Yuque-inspired block editor for Obsidian.
- Build on Wysimark Editor 1.3.2 and Slate, preserving upstream MIT attribution.
- Support parent/child block dragging, indentation, selection, deletion, and undo.
- Include rich-text formatting, theme-aware colors, lists, quotes, tables,
  code highlighting, images, find and replace, and slash commands.
- Integrate native outline navigation, Markdown storage, and automatic saving.
- Include the project logo, bilingual documentation, and reproducible packaging.
