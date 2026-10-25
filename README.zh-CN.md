<p align="center">
  <img src="assets/logo.png" alt="Blo Editor logo" width="160" height="160">
</p>

<h1 align="center">Blo Editor</h1>

<p align="center">语雀风格的 Obsidian 块编辑器。写笔记、整理结构，把表格、图片和画板放在同一页。</p>

<p align="center"><a href="README.md">English</a> · <strong>简体中文</strong></p>

<p align="center">
  <img src="assets/preview-light.png" alt="Blo Editor 浅色模式：标题、列表、表格、代码与原生大纲，使用公开示例" width="1200">
</p>

直接编辑内容，用块拖动与缩进整理思路。笔记仍保存为 Markdown，自动保存，支持带样式复制粘贴与内嵌画板。

通过 `Ctrl/Cmd+Shift+M`、工具栏公式按钮或 `/公式` 插入行内 LaTeX。
在原位置输入源码，失焦后渲染，双击公式重新编辑。复用 Obsidian 自带 MathJax，保存为 `$...$`，无需额外安装公式渲染插件。

## 与原生 Markdown 编辑入口不同的体验

**父子块操作**：正文、列表、引用、表格和代码都能组成块层级；拖动父块时包含子块。
拖动参考线显示目标缩进层级，Tab / Shift+Tab 调整缩进。重复按当前段落样式的快捷键可恢复正文。

<details>
<summary>展开查看块拖动与缩进截图</summary>

![块拖动预览：0、1、2 级缩进刻度与目标参考线](assets/feature-drag-indent.png)

</details>

**标题多级编号**：结合标题级别与缩进显示 `1.2.3`，只计入实际编号的上级。
默认延续同级编号，正文或代码块不会让序列意外重启；可手动重新编号。编号遵守标题和父块边界，正文列表仍用普通 `1.` 格式，并同步显示在原生大纲中。

<details>
<summary>展开查看标题编号与大纲截图</summary>

![公开演示：多级标题编号、父子块与同步的大纲编号](assets/feature-blocks-outline.png)

</details>

**按区域编辑表格**：支持单元格、矩形区域、整行和整列选择；悬浮工具栏调整对齐、标题行和标题列，
单击选格，双击、回车或空格进入编辑；直接输入可替换内容。Tab 切格，Shift+方向键扩展矩形选区，Backspace / Delete 清空内容；通过行列按钮选择后才删除行列。新建表格的默认标题样式可配置。

<details>
<summary>展开查看表格选区与悬浮工具栏截图</summary>

![公开演示：表格列选区、悬浮工具栏与跟随主题的导入文字](assets/feature-table-clipboard.png)

</details>

**带样式复制粘贴**：兼容语雀 Markdown 的颜色标签与加粗、下划线、列表、行内代码组合，也支持网页 HTML 粘贴。
向外复制同时提供标准富文本 HTML 和纯文本。外来字色映射到固定色板，近黑／近白字色与中性底色跟随主题。
导入或粘贴 Markdown 时，网络图片（含语雀的 `<img>` 标签）会下载到附件目录并改用本地预览；下载失败保留原链接，代码里的标签保持原样。

<details>
<summary>展开查看导入样式与主题颜色截图</summary>

![深色模式下导入的加粗、下划线、有色代码与中性文字](assets/feature-styled-clipboard.png)

</details>

**内嵌画板与附件**：画板预览与绘制内容贴合，单击选中、拖动等比缩放；右侧空白可放置光标，向左一格选中整个画板。
右上角「放大绘制」打开完整 Excalidraw 编辑器，左上角「返回笔记」保存并回到原笔记。
粘贴或拖入图片、音视频、PDF 和其他文件时，先存附件，再在原光标位置插入预览或链接。
库内已有的图片、画板等媒体可从文件浏览器直接拖入，引用原文件而不复制；「链接 → 本地库」也支持勾选嵌入显示预览。库内链接在编辑模式下按 Ctrl/Cmd 单击打开，阅读模式直接单击。

<details>
<summary>展开查看内嵌画板与附件截图</summary>

![公开演示：内嵌流程图、选中边框、等比缩放柄和放大绘制按钮](assets/feature-inline-drawing.png)

</details>

可直接试用 [块结构示例](examples/block-structure.md) 和 [表格与排版示例](examples/tables-and-formatting.md)。
画板示例见 [画板与附件示例](examples/drawings-and-attachments.md)，需同时复制 [示例画板](examples/inline-drawing.excalidraw.md)。
将示例复制到笔记库，用 Blo Editor 打开即可。
示例内容均为专门编写的演示资料，截图不包含私人标签页和文件树。

## 安装与使用

解压安装包，将 `blo-editor` 放入笔记库的 `.obsidian/plugins/`，
重启 Obsidian 后在第三方插件中启用 **Blo Editor**。需要桌面版 Obsidian 1.8.7 或更新版本。

输入 `/` 打开命令菜单，点击块柄进行块操作，悬浮工具栏调整格式。
斜杠菜单支持默认 3×3 表格、复选框、链接和图片；后两项复用工具栏插入菜单。
设置中的「工具栏配置」以同款图标和复选框控制按钮显示，即时生效。段落样式、清除格式、撤销、重做、字体颜色和查找／替换固定显示，对应选项保持勾选、置灰且不可修改。
支持查找替换、阅读模式、代码高亮及图片插入和缩放。正文自动保存，关闭标签页前也会保存，Ctrl+S 可立即保存。
通过文件浏览器右键菜单、标签页菜单或命令面板中的「Blo Editor：导出 PDF」直接导出渲染后的笔记，无需额外导出插件。支持 A4、A3、Letter、横向、页边距、标题和页码；保留代码高亮、表格、图片及画板预览，PDF 使用浅色背景。
删除块及其子块支持撤销。内嵌图片、音视频、PDF 和画板默认只删除引用；可开启「删除内嵌文件时删除附件」，仅将附件目录及子目录内、无其他引用的文件移入回收站，撤销时恢复并刷新预览。其他目录保留源文件；附件路径留空时仅限库根目录文件。

粘贴或导入的媒体和新画板默认保存在库根目录的 `附件` 文件夹。设置中的「附件保存路径」支持库内相对路径，如 `附件/素材`；留空保存到库根目录。更改设置不会迁移已有文件。视频支持播放、块选中和与图片相同的等比缩放。
代码块内 Tab / Shift+Tab 调整代码缩进，只有整个代码块被选中时才调整块缩进；语言菜单支持输入搜索。

标题 1～4 显示在大纲，子标题保留 H5 样式和较大间距但不进入大纲。
标题可以搭配有序列表。可在插件设置中关闭默认富文本入口，或限定自动打开的文件夹范围。
将“编辑范围”留空，整个库中任意位置新建的笔记都可默认使用插件。
“已有 Blo Editor 格式的笔记仍用 Blo Editor 打开”默认开启：已有或恢复的 Blo 标签页可继续打开范围外的笔记；关闭后，这些笔记会切回原生编辑器。

Ctrl+B 加粗，Ctrl+I 斜体，Ctrl+U 下划线，Ctrl+Alt+C 切换字体颜色，
Ctrl+F 查找，Ctrl+H 替换，Ctrl+Alt+P 切换阅读与编辑。
更多快捷键在 Obsidian 设置中搜索 **Blo Editor**。

在 Blo Editor 设置的「扩展功能」中开启「启用画板」，会自动安装并启用 [Excalidraw](https://github.com/zsviczian/obsidian-excalidraw-plugin)；已安装时直接复用。
通过 `/画板`、工具栏画板按钮或“插入画板”命令创建附件并内嵌预览；点击预览选中并调整大小，通过右上角“放大绘制”按钮在完整的 Excalidraw 标签页中编辑，
保存后自动刷新预览，通过左上角「返回笔记」保存并回到原笔记。预览和完整画板右上角均提供「另存为」，可将副本保存到库内相对路径；默认保留原引用，勾选「另存后替换当前引用」可更新对应引用，并支持撤销。是否同步删除附件由上述设置控制。

「启用图片查看器」会自动安装并启用 Image Toolkit，支持放大查看图片，并适配了工具栏图标和主题样式。关闭上述开关只停用 Blo 集成，保留依赖插件与附件。
底层编辑器是 Slate，依赖原生 CodeMirror 接口的第三方编辑插件需要单独适配。

## 构建

使用 Node.js 22，依次执行 `npm ci`、`npm run typecheck`、`npm run package`。
安装文件生成在 `dist/blo-editor/`，安装包 ZIP 生成在项目的 `releases/` 文件夹，文件名随版本变化。
Windows 使用 PowerShell 打包，macOS/Linux 需要 `zip` 命令。产物不包含个人设置、笔记、附件或迁移工具。
项目结构和维护约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开源协议

Blo 取自 block。作者：OrlandoHsu29。基于 Takeshi Morita 的 Wysimark Editor 1.3.2 二次开发，底层为 Slate；保留原作者版权、MIT 许可证及 [上游来源记录](UPSTREAM.json)。

本项目采用 [MIT License](LICENSE)。Blo Editor 的修改部分版权归 OrlandoHsu29 所有；保留 Takeshi Morita 的上游版权声明和许可证。
