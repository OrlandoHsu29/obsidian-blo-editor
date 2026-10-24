# Blo Editor 0.1.16 — 库内媒体嵌入、视频缩放与画板另存为

## 中文

- **库内媒体嵌入与链接**：从文件浏览器拖入已有图片、视频、画板等媒体，直接引用原文件；本地库链接菜单支持嵌入，自动识别本库链接和路径。编辑模式 Ctrl/Cmd 单击打开内部链接，阅读模式直接单击。
- **视频块交互**：保留播放控件，支持块选中、等比缩放和尺寸预设；尺寸可保存，并支持撤销与重做。
- **画板另存为**：按库内相对路径保存副本，同名自动避让，保留原画板和当前引用。
- **统一附件删除设置**：合并为默认关闭的“删除内嵌文件时删除附件”，覆盖图片、音视频、PDF 和画板。仅清理附件目录及子目录内无其他引用的文件；其他目录保留原文件，路径留空时仅限库根目录文件。删除移入回收站，撤销恢复附件及预览。旧版分类型开关不会自动开启新的统一开关，请按需重新开启。
- **标题与视图恢复**：标题末尾按回车在正文开头插入空行；修复已有 Blo 格式笔记在自动编辑范围外回退到原生视图后无法恢复的问题，仍保留主动打开原生编辑器的选择。

安装：下载 blo-editor-0.1.16.zip，将解压后的 blo-editor 文件夹放入笔记库的 .obsidian/plugins/。更新时保留已有 data.json，然后重新加载插件或重启 Obsidian。

要求桌面版 Obsidian **1.8.7 或更新版本**；画板功能需另行启用 Excalidraw。也提供单独的 main.js、styles.css 和 manifest.json。

## English

- **Vault media and links:** drag existing images, videos and drawings from the file explorer to embed the original without copying it. Embed media from the vault link dialog and resolve this vault's copied links and paths. Ctrl/Cmd-click internal links while editing; click directly in reading mode.
- **Video blocks:** keep native playback controls while adding atomic selection, proportional resizing, size presets, persisted dimensions and undo/redo.
- **Save drawing as:** save a vault-relative copy with collision-safe naming, preserving the original and current embed.
- **Unified attachment cleanup:** one disabled-by-default option covers images, audio, video, PDFs and drawings. Only unreferenced files inside the attachment folder and subfolders go to trash. Other folders keep originals; an empty path covers root-level files only. Undo restores files and previews. Previous per-type toggles do not automatically enable the new unified setting; enable it again if desired.
- **Title and view recovery:** Enter at the end of the file title inserts a leading body paragraph. Restore existing Blo-formatted notes outside the automatic editing scope while respecting an explicit switch to the native editor.

Install blo-editor-0.1.16.zip by placing the extracted blo-editor directory in your vault's .obsidian/plugins/. Preserve an existing data.json, then reload the plugin or restart Obsidian.

Requires desktop Obsidian **1.8.7 or later**. Drawing features require the optional Excalidraw plugin. Standalone main.js, styles.css and manifest.json assets are also included.
