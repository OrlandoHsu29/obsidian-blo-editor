# Blo Editor

<p align="center">
  <img src="assets/logo.png" alt="Blo Editor logo" width="128" height="128">
</p>

Blo 取自 block。遵循语雀编辑习惯的 Obsidian 块编辑器，底层使用 Slate。

作者：OrlandoHsu29。基于 Takeshi Morita 的 Wysimark Editor 1.3.2 二次开发，
保留原作者版权、MIT 许可证和上游来源记录。

## 安装与使用

解压安装包，将 `inknote-editor` 放入笔记库的 `.obsidian/plugins/`，
重启 Obsidian 后在第三方插件中启用 **Blo Editor**。需要桌面版 Obsidian 1.8.7 或更新版本。

点击六点块柄会选中整块并打开菜单；Tab / Shift+Tab 调整缩进，拖动父块时包含子块。
菜单中的“删除块”删除当前块及其子块，支持撤销；删除图片块不会删除附件文件。
支持字体样式与颜色、列表、引用、表格、代码高亮、查找替换、斜杠菜单和原生大纲。
正文自动保存，关闭标签页前也会保存，Ctrl+S 可立即保存。

标题 1～4 显示在大纲，子标题保留 H5 样式和较大间距但不进入大纲。
标题可以搭配有序列表。可在插件设置中关闭默认富文本入口，或限定自动打开的文件夹范围。

Ctrl+B 加粗，Ctrl+I 斜体，Ctrl+U 下划线，Ctrl+Alt+C 切换字体颜色，
Ctrl+F 查找，Ctrl+H 替换，Ctrl+Alt+P 切换阅读与编辑。
更多快捷键在 Obsidian 设置中搜索 **Blo Editor**。

图片插入及缩放可以独立使用，图片查看器 Obsidian Image Toolkit 是可选插件。
底层编辑器是 Slate，依赖原生 CodeMirror 接口的第三方编辑插件需要单独适配。

## 构建

使用 Node.js 22，依次执行 `npm ci`、`npm run typecheck`、`npm run package`。
安装文件生成在 `dist/inknote-editor/`，安装包 ZIP 直接生成在项目根目录，文件名随版本变化。
Windows 使用 PowerShell 打包，macOS/Linux 需要 `zip` 命令。产物不包含个人设置、笔记、附件或迁移工具。
项目结构和维护约定见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开源协议

本项目采用 [MIT License](LICENSE)。Blo Editor 的修改部分版权归 OrlandoHsu29 所有；保留 Takeshi Morita 的上游版权声明和许可证。
