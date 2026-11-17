# Blo Editor 0.2.4

## 中文

- Ctrl+] / Ctrl+[ 仅缩进或回退当前块；Tab / Shift+Tab 保留子树操作。工具栏提供两种范围菜单，Glimmer Memo 默认显示缩进工具。
- 工具栏展开菜单仅点击切换，不再悬停自动切换。
- 长文档按分组缓存真实高度，允许离屏内容跳过布局与绘制；恢复显示使用轻量淡入，保留原生选区与复制逻辑。
- PDF 和画板按视口延迟加载，滚动停稳约 80ms 后优先处理当前可见区域；复用已加载预览，离屏暂停 PDF 队列，保留页码和缩放。
- 表格优先适配当前视口，暂停期间使用定时唤醒而非逐帧空转；忽略离屏零宽度，避免缓存表格反复进入占位状态。
- 复用首行位置测量，减少浮层对无关滚动的响应；导出会补齐离屏画板并正确显示待恢复分组。

## English

- Ctrl+] / Ctrl+[ indent or outdent only the current block; Tab / Shift+Tab keep subtree behavior. Toolbar menus expose both scopes, with indentation tools visible by default in Glimmer Memo.
- Switch expandable toolbar menus on click instead of hover.
- Cache real chunk heights so offscreen content can skip layout and painting, with lightweight fade-in and preserved native selection and clipboard behavior.
- Load PDFs and drawings near the viewport after about 80ms of scroll inactivity, prioritize visible content and reuse loaded previews. Pause offscreen PDF rendering without resetting page or zoom.
- Prioritize visible table fitting and sleep on timers instead of polling every frame. Ignore offscreen zero-width reports to avoid remasking cached tables.
- Reuse first-line measurements, avoid unrelated overlay scroll measurements, and include deferred drawings and hidden chunks in exports.

## Validation / 验证

Type checking, 868 automated tests and production packaging. Live checks covered deferred PDF/drawing loads, continuous-scroll deferral, cached reuse, monotonic fade-in, media selection, clipboard, heading navigation and HTML export. No numerical FPS improvement is claimed.

安装：解压 blo-editor-0.2.4.zip 中的 blo-editor/ 到笔记库 .obsidian/plugins/，保留 data.json。
Installation: extract blo-editor/ into the vault's .obsidian/plugins/, preserving data.json. Requires desktop Obsidian 1.8.7+.
