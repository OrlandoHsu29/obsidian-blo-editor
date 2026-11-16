# Blo Editor 0.2.0

## 中文

- 新增居中全屏演示模式，退出后恢复编辑／阅读状态及滚动位置，滚动条位于窗口右侧。
- 新增平滑、收尖的激光笔，轨迹随页面滚动；普通松手停顿 300 毫秒后，用约 600 毫秒加速追赶终点并收细。已消退的轨迹沿用当前速度，短尾迹可提前完成。
- 图片查看器覆盖在演示上方，关闭后继续演示；PDF、画板及标签页切换会安全退出演示，避免旧全屏区域挡住新界面。
- 新增六色高亮工具，放在字体颜色与加粗之间，并优先显示在紧凑工具栏中。颜色按钮点击即切换样式并展开菜单，保持选区，重复点击不闪烁。
- 工具栏使用半透明紫色选中背景，调整字体颜色、高亮、加粗图标及分隔线。
- 引用图片复用普通图片的选中和边缘缩放，保留 Wiki 引用、尺寸、撤销及引用提示框；移除图片尺寸预设浮动工具栏，避免遮挡。
- 清理引用提示框的延迟回调并使用当前节点；缓存未变化的激光笔平滑曲线，减少逐帧重复计算。
- 去除主窗口正文滚动区底部多余的 32 像素留白。

验证：类型检查、793 项自动化测试及生产打包通过。已在 Obsidian 中验证演示、图片查看器关闭后继续演示、PDF／画板与标签页导航，以及引用图片的选中、缩放、撤销和只读状态。

## English

- Add centered fullscreen presentation with a window-edge scrollbar. Restore the previous editing/reading state and scroll position on exit.
- Add a smoothed, tapered laser trail that follows document scrolling. Ordinary release pauses for 300 ms before an accelerating sweep and thinning over about 600 ms. Already decaying trails retain their speed; short remnants may finish sooner.
- Keep image viewers above the presentation and resume it on close. Safely exit presentation for PDF/drawing navigation and tab changes.
- Add six-color highlighting between text color and bold, with priority in compact toolbars. Color buttons toggle the style and open a stable palette while preserving the selection.
- Use translucent purple active backgrounds and refine color, highlight, bold and separator appearance.
- Reuse image selection and edge resizing for Wiki image references, preserving references, dimensions, undo and reference popovers. Remove image size-preset toolbars to avoid overlap.
- Cancel stale reference-popup callbacks and resolve actions against the current node. Cache unchanged laser curves instead of rebuilding them every frame.
- Remove the extra 32 px bottom gap around the main note scroller.

Validation: type checking, 793 automated tests and production packaging passed. Live Obsidian checks covered presentation, image-viewer close/resume, PDF/drawing and tab navigation, and Wiki image selection, resizing, undo and read-only behaviour.

## 安装 / Installation

将 `blo-editor-0.2.0.zip` 中的 `blo-editor/` 解压到笔记库的 `.obsidian/plugins/`，升级时保留 `data.json`。需要桌面版 Obsidian 1.8.7+。

Extract `blo-editor/` from `blo-editor-0.2.0.zip` into your vault's `.obsidian/plugins/`, preserving `data.json`. Requires desktop Obsidian 1.8.7+.

[完整版本差异 / Full comparison](https://github.com/OrlandoHsu29/obsidian-blo-editor/compare/v0.1.38...v0.2.0)
