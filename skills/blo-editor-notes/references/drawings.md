# 可编辑画板与附件

Blo 画板集成使用 Excalidraw，不是 Obsidian `.canvas`。需要原生 Canvas 时按用户要求单独处理，不把两种格式混写。画板预览/编辑要求启用 Excalidraw；Blo 设置中的「启用画板」可安装并启用依赖，但 Skill 安装本身不修改插件设置。

## 创建

1. 确定库内附件目录，默认 `附件`，以本库设置为准。选择不冲突的 `.excalidraw.md` 文件名。
2. 使用支持 Excalidraw 的工具生成场景；没有该工具时，以 [随附示例](../assets/example.excalidraw.md) 为已知可用文件结构，构造完整场景 JSON。示例中的形状、文本及箭头都可直接编辑，不是截图。
3. 先写附件，确认存在后在笔记相应块写 `![[附件/方案.excalidraw.md|720x300]]`。这里是库根相对路径，尺寸控制预览；Blo 会按画板真实内容比例显示，不需要为了尺寸改场景坐标。

文件结构为：

````text
---
excalidraw-plugin: parsed
---

# Excalidraw Data

## Text Elements

%%
## Drawing
```json
{"type":"excalidraw","version":2,"source":"https://excalidraw.com","elements":[],"appState":{"viewBackgroundColor":"#ffffff","gridSize":null},"files":{}}
```
%%
````

空 elements 只是结构说明，不能作为已完成的流程图交付。实际场景需包含任务要求的形状、文字及连线。每个元素 ID 唯一；文字保留 text/originalText、fontSize、fontFamily、lineHeight、width/height；文本框给中文及换行留足空间。箭头 points 使用相对坐标；设置绑定时对应元素的 boundElements 也应一致。可以像示例那样使用未绑定箭头，但不要宣称它们会随形状移动。图形浅色填充配深色描边，检查深浅色预览的可读性。

## 修改已有画板

尽量通过 Excalidraw 工具修改并保存，保留未知字段、元素 ID、分组、绑定、文件资源和用户布局。已有场景可能使用 `compressed-json`；不要把压缩文本当普通 JSON，也不要用新示例覆盖旧图。优先使用可用工具读取/保存；工具无法解码时说明限制，或创建独立副本并按用户要求更新引用。

Blo 单击预览可选中和等比缩放，右上「放大绘制」打开完整画板，左上「返回笔记」保存返回，附件修改后预览刷新。「另存为」默认保留原引用，选择替换当前引用后才修改对应笔记。

## 其他附件

图片、音视频、PDF 和其他文件应先保存成功再嵌入。库内已有附件直接引用，不重复复制。未知文件类型通过 Obsidian 文件嵌入显示。远程资源下载失败时保留真实链接并说明，不能留下声称已本地化的无效路径。

删除引用不等于删除文件；AI 不应自行删除附件。用户可能在 Blo 中启用了「删除内嵌文件时删除附件」，插件会按目录范围、其他引用与回收站规则处理，不能用文件系统强删来模拟。不要在附件或 Skill 中收集个人设置、其他笔记及凭据。
