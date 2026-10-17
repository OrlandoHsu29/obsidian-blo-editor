# 墨笺编辑器 · InkNote Editor

作者：OrlandoHsu29。桌面版 Obsidian 富文本笔记插件，基于 takeshy 的 Obsidian Wysimark Editor 1.3.2 二次开发，使用 Slate 和 React。保留上游 MIT 许可证和版权声明，来源版本见 UPSTREAM.json，原项目说明见 README_UPSTREAM.md。

## 安装

1. 解压安装包，将 inknote-editor 文件夹放到笔记库的 .obsidian/plugins/ 内。
2. 重启 Obsidian，在“设置 → 第三方插件”启用“墨笺编辑器”。
3. 打开 Markdown 笔记即可编辑；若同时启用其他富文本编辑插件，请先停用它们。

要求：桌面版 Obsidian 1.8.7 或更新版本。安装包不包含个人配置、笔记、附件、迁移工具或测试代码。

## 使用

自动保存编辑内容，关闭标签页前也会保存；Ctrl+S 可立即保存。右上角原生图标切换编辑和阅读。设置中可关闭默认富文本入口，或填写文件夹限制自动打开范围；留空覆盖整个库。

支持块拖动和缩进、有序和无序列表、表格标题行列、代码语法高亮、字体颜色、查找替换以及 / 命令菜单。标题 1～4 进入大纲，子标题保留 H5 样式但不进入大纲；标题只能搭配有序列表。

Ctrl+B 加粗，Ctrl+I 斜体，Ctrl+U 下划线，Ctrl+Shift+X 删除线，Ctrl+Alt+C 切换选定颜色，Ctrl+F 查找，Ctrl+H 替换。更多命令和快捷键可在 Obsidian 设置中搜索“墨笺编辑器”。

图片插入、显示尺寸调整可独立使用；额外图片查看器需另行安装 Obsidian Image Toolkit，未安装时不影响编辑。富文本底层为 Slate，依赖原生 CodeMirror 编辑接口的第三方编辑插件需单独适配。

## 源码构建

使用 Node.js 和 npm，运行 npm ci、npm run typecheck、npm run build。将生成的 main.js 和 manifest.json、styles.css 放入插件目录。源码包保留运行代码和构建配置，不包含验收工具、测试页面或个人开发目录。
