# Changelog

## 0.1.20 — 2026-10-26

- Show quick memo notes from Flash Memo with Blo Editor: hide the duplicated
  file name, keep a compact toolbar at the top, save before the panel hides, and
  focus the editor so typing starts immediately. Turning the integration off
  returns the memo note to the native editor.
- Enable optional integrations automatically when Image Toolkit, Excalidraw or
  Flash Memo is already enabled, and remember switches turned off manually.
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
