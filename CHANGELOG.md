# Changelog

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
