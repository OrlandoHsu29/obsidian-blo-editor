# Contributing

Use Node.js 22 and npm. Run `npm ci`, `npm run typecheck`, and `npm run package`.
The installable plugin is generated in `dist/blo-editor/`.

## Source layout

- `src/main.ts`: Obsidian lifecycle, settings, and commands.
- `src/settings.ts`: typed defaults and the native settings UI.
- `src/BloView.tsx`: file loading, saving, and rich-text view integration.
- `src/blocks/`: block structure, indentation, dragging, selection, and menus.
- `src/search/`: document search and replacement.
- `src/wysimark/`: editor plugins and Markdown parsing/serialization, derived from upstream.
- `styles.css`: application layout and theme integration.
- `scripts/package.mjs`: production build and distributable files.

Keep document edits in Slate operations. Formatting helpers must preserve undo,
selection, Markdown content, and attachment paths. DOM caret placeholders must
never become saved characters. Chunk wrappers must not cover neighboring text
with transparent padding or negative vertical margins.

Use the existing caches and visible-block measurements rather than scanning all
editor nodes or the entire document on every keystroke. Unregister menu listeners,
observers, and timers when their owner closes.

Do not commit personal vaults, credentials, `data.json`, dependencies, generated
bundles, temporary profiling tools, or validation notes. Preserve the upstream
copyright and MIT license when sharing modifications.

Keep all development and release artifacts in this project. `npm run package`
creates the versioned installation ZIP in the project root. Do not create
source snapshots or release staging directories in a personal Obsidian vault.
