# Blo Editor

<p align="center">
  <img src="assets/logo.png" alt="Blo Editor logo" width="128" height="128">
</p>

A Yuque-inspired block editor for Obsidian, built on Wysimark Editor and Slate.
Blo comes from block. Maintained by **OrlandoHsu29**.
Based on [Wysimark Editor](https://github.com/takeshy/obsidian-wysimark) 1.3.2
by Takeshi Morita. Upstream copyright and the MIT license are retained.
See [UPSTREAM.json](UPSTREAM.json) and [the original README](https://github.com/takeshy/obsidian-wysimark#readme).

[中文说明](README.zh-CN.md)

## Preview

Light mode — headings, lists, tables, code, and the native outline:

![Light mode overview using a synthetic knowledge-base note](assets/preview-light.png)

Dark mode — the same note follows the current theme:

![Dark mode overview of the same synthetic note](assets/preview-dark.png)

Open any image to view the original high-resolution PNG.

## A block editing workflow

Alongside Obsidian's native Markdown editor, Blo offers:

**Parent and child blocks.** Drag a parent together with its text, lists, quotes,
tables, and code children. Drop guides show indentation levels; Tab / Shift+Tab
adjust indentation. Repeating the active paragraph-style shortcut restores body text.

<details>
<summary>View block dragging and indentation</summary>

![Block drag preview with indentation levels 0, 1, and 2](assets/feature-drag-indent.png)

</details>

**Hierarchical heading numbers.** Combine heading levels and indentation to
display `1.2.3`, counting only numbered ancestors. Continue/restart rules respect
heading and parent-block boundaries; intervening text and code do not restart
same-level numbering. Restart manually when needed; body lists keep ordinary `1.` markers.
Heading numbers also appear in the native outline.

<details>
<summary>View heading numbers and outline</summary>

![Synthetic project plan with hierarchical numbers and matching outline entries](assets/feature-blocks-outline.png)

</details>

**Table editing by cells, rows, or columns.** Select a rectangle or use row/column
handles and adjust alignment and headers from the floating toolbar. Click to select
a cell; double-click, Enter, or Space to edit, or type to replace its contents.
Tab moves between cells; Shift+arrows extend a rectangle. Backspace/Delete clear
contents; select row/column handles to remove rows/columns. Set default header styles.

<details>
<summary>View table selection and floating controls</summary>

![Synthetic feature table with a selected column and theme-aware imported text](assets/feature-table-clipboard.png)

</details>

**Styled copy and paste.** Import Yuque Markdown color tags combined with bold,
underline, lists, and inline code, or paste web HTML. Copy out as standard rich
HTML and plain text. Imported colors map to the toolbar palette; near-black/white
text and neutral backgrounds follow the current theme.

<details>
<summary>View imported formatting and theme-aware colors</summary>

![Imported bold, underline, colored code, and neutral text in dark mode](assets/feature-styled-clipboard.png)

</details>

**Inline drawings and attachments.** Drawing previews fit their content. Click to
select, drag to resize proportionally, or place the caret in the right gutter and
press Left to select the drawing. The top-right editor button opens Excalidraw;
**Back to note** saves, closes that drawing tab, and returns to the original note.
Pasted or dropped images, audio, video, PDFs, and other files are saved as
attachments before their previews or links are inserted at the original cursor.

<details>
<summary>View inline drawings and attachments</summary>

![Public flowchart demo with a selected drawing, proportional resize handle, and drawing editor button](assets/feature-inline-drawing.png)

</details>

Try the [block structure example](examples/block-structure.md) and
[table and formatting example](examples/tables-and-formatting.md).
For the [drawing and attachment example](examples/drawings-and-attachments.md),
also copy [the sample drawing](examples/inline-drawing.excalidraw.md).
Copy them into your vault and open them with Blo Editor.
The notes contain synthetic content; the screenshots exclude private tabs and the file tree.

## Installation

1. Extract the release ZIP and copy `blo-editor` into your vault's `.obsidian/plugins/`.
2. Restart Obsidian and enable **Blo Editor** under Community plugins.
3. Open a Markdown note. Disable other rich-text editor plugins to avoid competing default views.

Requires desktop Obsidian 1.8.7 or later. Release packages contain no personal
settings, notes, attachments, dependencies, or migration tools.

## Editing and compatibility

Use `/` for commands, the block handle for block actions, and the floating toolbar
for formatting. Find/replace, reading mode, code highlighting, image insertion and
resizing are included. Changes save automatically and before closing; Ctrl+S saves
immediately. Removing an image or drawing keeps its attachment by default.
Separate settings can move unreferenced image/drawing attachments to trash on
deletion. Undo restores the attachment and refreshes the preview automatically.

Images and drawings share the vault-root `附件` folder by default. **Attachment
folder** accepts a vault-relative path such as `Attachments/Media`; leave empty
for the vault root. Changing this setting does not move existing files.
Tab / Shift+Tab indent code text unless the entire code block is selected;
the language menu supports typing to search.

Headings 1–4 appear in the outline. Subheadings use H5 styling with extra spacing
and stay out of the outline. Headings can be combined with ordered lists.
The default editor can cover the whole vault or a folder configured in settings.
Leave **Default editing scope** empty to include new notes created anywhere in the vault.

Common shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Alt+C text
color, Ctrl+F find, Ctrl+H replace, and Ctrl+Alt+P reading/editing mode.
Commands and custom bindings are available in Obsidian's hotkey settings.

For embedded drawings, install and enable [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin).
Use `/drawing`, the drawing toolbar button, or **Insert drawing** to create an attachment
and embed its preview. Click the preview to select and resize it; use its top-right
**Open drawing editor** button to draw in a full-size Excalidraw tab;
saved changes refresh the preview. **Back to note** saves and returns to the source
note. Attachment deletion follows the settings described above.

Obsidian Image Toolkit is an optional image viewer. The editor uses Slate; third-party editing extensions
that require CodeMirror do not automatically apply to this view.

## Development

```sh
npm ci
npm run typecheck
npm run package
```

Use Node.js 22. `npm run package` builds production code and creates a clean
`dist/blo-editor/` folder and `releases/blo-editor-<version>.zip`.
Packaging uses PowerShell on Windows and `zip` on macOS/Linux.
`npm run dev` watches source changes.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the source layout and development rules.

## License

MIT. Copyright belongs to the respective upstream authors and OrlandoHsu29 for
Blo Editor modifications. Preserve [LICENSE](LICENSE) and the upstream attribution.
