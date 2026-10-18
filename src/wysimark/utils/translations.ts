import { getLanguage as getObsidianLanguage } from 'obsidian'

export const translations = {
  "en": {
    "bold": "Bold",
    "italic": "Italic",
    "strike": "Strikethrough",
    "inlineCode": "Inline Code",
    "underline": "Underline",
    "increaseDepth": "Increase Depth",
    "decreaseDepth": "Decrease Depth",
    "heading1": "Heading 1",
    "heading2": "Heading 2",
    "heading3": "Heading 3",
    "heading4": "Heading 4",
    "heading5": "Subheading",
    "normal": "Normal",
    "paragraph": "Paragraph",
    "paragraphStyle": "Paragraph Style",
    "bulletList": "Bullet List",
    "numberedList": "Numbered List",
    "checkList": "Check List",
    "list": "List",
    "linkUrl": "Link URL",
    "linkTypeExternal": "External",
    "linkTypeInternal": "Vault",
    "internalLinkTarget": "Vault File",
    "internalLinkTargetHint": "Select a file, then optionally append #Heading",
    "internalLinkEmbed": "Insert as embed",
    "internalLinkEmbedHint": "When on, inserts as ![[...]]",
    "linkText": "Link Text",
    "linkTextHint": "Text displayed as the link",
    "tooltipText": "Tooltip Text",
    "tooltipHint": "Tooltip shown on mouse hover",
    "apply": "Apply",
    "cancel": "Cancel",
    "edit": "Edit",
    "remove": "Remove",
    "insertLink": "Link",
    "quote": "Quote",
    "insertTable": "Table",
    "insertImage": "Image",
    "insertImageFromUrl": "Image",
    "insert": "Insert",
    "format": "Format",
    "imageUrlRequired": "Image URL (required):",
    "altText": "Alt Text:",
    "title": "tooltip:",
    "imageDescription": "Description of the image",
    "imageTitle": "tooltip",
    "switchToVisualEditor": "Switch to visual editor",
    "switchToRawMarkdown": "Switch to raw markdown",
    "codeBlock": "Code Block",
    "increaseQuoteDepth": "Increase Quote Depth",
    "horizontalRule": "Horizontal Rule",
    "register": "Register",
    "imageSourceUrl": "URL",
    "imageSourceFile": "File",
    "vaultImageRequired": "Vault image (required):",
    "vaultImagePlaceholder": "Select an image or enter its path",
    "selectFile": "Select File",
    "uploading": "Uploading...",
    "saving": "Saving...",
    "vaultPath": "Save Path:",
    "vaultPathHint": "Enter the path within the vault to save the file"
  },
  "zh": {
    "bold": "加粗",
    "italic": "斜体",
    "strike": "删除线",
    "inlineCode": "行内代码",
    "underline": "下划线",
    "increaseDepth": "增加缩进",
    "decreaseDepth": "减少缩进",
    "heading1": "标题 1",
    "heading2": "标题 2",
    "heading3": "标题 3",
    "heading4": "标题 4",
    "heading5": "子标题",
    "normal": "正文",
    "paragraph": "段落",
    "paragraphStyle": "段落样式",
    "bulletList": "无序列表",
    "numberedList": "有序列表",
    "checkList": "任务列表",
    "list": "列表",
    "linkUrl": "链接地址",
    "linkTypeExternal": "外部链接",
    "linkTypeInternal": "本地库",
    "internalLinkTarget": "本地库文件",
    "internalLinkTargetHint": "选择文件，可在后面追加 #标题",
    "internalLinkEmbed": "作为嵌入插入",
    "internalLinkEmbedHint": "开启后以 ![[...]] 形式嵌入",
    "linkText": "链接文字",
    "linkTextHint": "链接显示的文字",
    "tooltipText": "悬停提示",
    "tooltipHint": "鼠标悬停时显示的提示",
    "apply": "应用",
    "cancel": "取消",
    "edit": "编辑",
    "remove": "删除",
    "insertLink": "链接",
    "quote": "引用",
    "insertTable": "表格",
    "insertImage": "图片",
    "insertImageFromUrl": "图片",
    "insert": "插入",
    "format": "文字样式",
    "imageUrlRequired": "图片地址（必填）",
    "altText": "替代文字",
    "title": "悬停提示",
    "imageDescription": "图片描述",
    "imageTitle": "图片悬停提示",
    "switchToVisualEditor": "切换到富文本编辑",
    "switchToRawMarkdown": "切换到 Markdown 源码",
    "codeBlock": "代码块",
    "increaseQuoteDepth": "增加引用层级",
    "horizontalRule": "分割线",
    "register": "确认",
    "imageSourceUrl": "网址",
    "imageSourceFile": "本地文件",
    "vaultImageRequired": "本地库图片（必填）",
    "vaultImagePlaceholder": "选择图片或输入路径",
    "selectFile": "选择文件",
    "uploading": "正在上传…",
    "saving": "正在保存…",
    "vaultPath": "保存路径",
    "vaultPathHint": "输入在本地库中的保存路径"
  }
} as const
export const uiMessages = {
  "Markdown 笔记默认使用富文本编辑；阅读视图不受影响。": { zh: "Markdown 笔记默认使用富文本编辑；阅读视图不受影响。", en: "Open Markdown notes in the rich editor by default; reading views are unaffected." },
  "默认编辑范围": { zh: "默认编辑范围", en: "Default editing scope" },
  "留空应用于整个库；填写文件夹路径可限制范围。": { zh: "留空应用于整个库；填写文件夹路径可限制范围。", en: "Leave blank for the whole vault, or enter a folder path to limit the scope." },
  "右侧插入列":{zh:"右侧插入列",en:"Insert column right"},
  "左侧插入列":{zh:"左侧插入列",en:"Insert column left"},
  "删除列":{zh:"删除列",en:"Delete column"},
  "下方插入行":{zh:"下方插入行",en:"Insert row below"},
  "上方插入行":{zh:"上方插入行",en:"Insert row above"},
  "删除行":{zh:"删除行",en:"Delete row"},
  "标题列":{zh:"标题列",en:"Header column"},
  "默认标题行":{zh:"默认标题行",en:"Default header row"},
  "默认标题列":{zh:"默认标题列",en:"Default header column"},
  "标题行":{zh:"标题行",en:"Header row"},
  "清除格式": {"zh":"清除格式","en":"Clear formatting"},
  "撤销": {"zh":"撤销","en":"Undo"},
  "重做": {"zh":"重做","en":"Redo"},
  "字体颜色": {
    "zh": "字体颜色",
    "en": "Text color"
  },
  "颜色": {
    "zh": "颜色",
    "en": "Colors"
  },
  "系统颜色": {
    "zh": "系统颜色",
    "en": "System color"
  },
  "红色": {
    "zh": "红色",
    "en": "Red"
  },
  "橙色": {
    "zh": "橙色",
    "en": "Orange"
  },
  "黄色": {
    "zh": "黄色",
    "en": "Yellow"
  },
  "绿色": {
    "zh": "绿色",
    "en": "Green"
  },
  "蓝色": {
    "zh": "蓝色",
    "en": "Blue"
  },
  "紫色": {
    "zh": "紫色",
    "en": "Purple"
  },
  "灰色": {
    "zh": "灰色",
    "en": "Gray"
  },
  "文件名": {
    "zh": "文件名",
    "en": "File name"
  },
  "文件名；修改后按 Enter 或点击正文重命名": {
    "zh": "文件名；修改后按 Enter 或点击正文重命名",
    "en": "File name; press Enter or click the document to rename"
  },
  "文件名不能为空，也不能包含路径或特殊字符": {
    "zh": "文件名不能为空，也不能包含路径或特殊字符",
    "en": "Enter a file name without path separators or special characters"
  },
  "已有同名文件，请使用其他名称": {
    "zh": "已有同名文件，请使用其他名称",
    "en": "A file with this name already exists"
  },
  "重命名失败：": {
    "zh": "重命名失败：",
    "en": "Could not rename file: "
  },
  "开始输入…": {
    "zh": "开始输入…",
    "en": "Start writing…"
  },
  "切换到阅读模式（Ctrl+Alt+P）": {
    "zh": "切换到阅读模式（Ctrl+Alt+P）",
    "en": "Switch to reading mode (Ctrl+Alt+P)"
  },
  "返回富文本编辑（Ctrl+Alt+P）": {
    "zh": "返回富文本编辑（Ctrl+Alt+P）",
    "en": "Return to rich text editing (Ctrl+Alt+P)"
  },
  "从文件重新载入": {
    "zh": "从文件重新载入",
    "en": "Reload from file"
  },
  "缩进为子块": {
    "zh": "缩进为子块",
    "en": "Indent as child block"
  },
  "删除块": {
    "zh": "删除块",
    "en": "Delete block"
  },
  "减少缩进": {
    "zh": "减少缩进",
    "en": "Decrease indentation"
  },
  "拖动块或打开块菜单": {
    "zh": "拖动块或打开块菜单",
    "en": "Drag block or open block menu"
  },
  "拖动整块及子块；点击设置缩进": {
    "zh": "拖动整块及子块；点击设置缩进",
    "en": "Drag this block and its children; click for indentation"
  },
  "拖动整块及子块；点击选中并打开块菜单": {
    "zh": "拖动整块及子块；点击选中并打开块菜单",
    "en": "Drag block and children; click to select and open the block menu"
  },
  "当前文档查找和替换": {
    "zh": "当前文档查找和替换",
    "en": "Find and replace in this document"
  },
  "查找文字": {
    "zh": "查找文字",
    "en": "Find text"
  },
  "区分大小写": {
    "zh": "区分大小写",
    "en": "Match case"
  },
  "上一个（Shift+Enter）": {
    "zh": "上一个（Shift+Enter）",
    "en": "Previous (Shift+Enter)"
  },
  "下一个（Enter）": {
    "zh": "下一个（Enter）",
    "en": "Next (Enter)"
  },
  "展开或收起替换": {
    "zh": "展开或收起替换",
    "en": "Show or hide replace"
  },
  "关闭（Esc）": {
    "zh": "关闭（Esc）",
    "en": "Close (Esc)"
  },
  "替换为": {
    "zh": "替换为",
    "en": "Replace with"
  },
  "替换当前": {
    "zh": "替换当前",
    "en": "Replace current"
  },
  "全部替换": {
    "zh": "全部替换",
    "en": "Replace all"
  },
  "无结果": {
    "zh": "无结果",
    "en": "No results"
  },
  "默认使用富文本编辑器": {
    "zh": "默认使用富文本编辑器",
    "en": "Use rich text editing by default"
  },
  "DevNote 中的 Markdown 笔记使用富文本编辑；阅读视图不受影响。": {
    "zh": "DevNote 中的 Markdown 笔记使用富文本编辑；阅读视图不受影响。",
    "en": "Open Markdown notes in DevNote with rich text editing; reading mode remains available."
  },
  "原始尺寸": {
    "zh": "原始尺寸",
    "en": "Original size"
  },
  "放大": {
    "zh": "放大",
    "en": "Zoom in"
  },
  "缩小": {
    "zh": "缩小",
    "en": "Zoom out"
  },
  "全屏": {
    "zh": "全屏",
    "en": "Full screen"
  },
  "刷新": {
    "zh": "刷新",
    "en": "Refresh"
  },
  "向左旋转": {
    "zh": "向左旋转",
    "en": "Rotate left"
  },
  "向右旋转": {
    "zh": "向右旋转",
    "en": "Rotate right"
  },
  "水平翻转": {
    "zh": "水平翻转",
    "en": "Flip horizontally"
  },
  "垂直翻转": {
    "zh": "垂直翻转",
    "en": "Flip vertically"
  },
  "反色": {
    "zh": "反色",
    "en": "Invert colors"
  },
  "复制": {
    "zh": "复制",
    "en": "Copy"
  },
  "清除文字样式": {
    "zh": "清除文字样式",
    "en": "Clear text formatting"
  },
  "查找当前文档": {
    "zh": "查找当前文档",
    "en": "Find in current document"
  },
  "替换当前文档": {
    "zh": "替换当前文档",
    "en": "Replace in current document"
  },
  "打开简洁命令菜单": {
    "zh": "打开简洁命令菜单",
    "en": "Open slash command menu"
  },
  "应用上次字体颜色": {
    "zh": "应用上次字体颜色",
    "en": "Apply last text color"
  },
  "打开富文本编辑器": {
    "zh": "打开富文本编辑器",
    "en": "Open rich text editor"
  },
  "在当前标签打开原生编辑器": {
    "zh": "在当前标签打开原生编辑器",
    "en": "Open native editor in current tab"
  },
  "切换富文本编辑与阅读": {
    "zh": "切换富文本编辑与阅读",
    "en": "Toggle rich text editing and reading"
  },
  "简洁命令菜单": {
    "zh": "简洁命令菜单",
    "en": "Slash command menu"
  },
  "继续编号": {
    "zh": "继续编号",
    "en": "Continue numbering"
  },
  "重新编号（从 1 开始）": {
    "zh": "重新编号（从 1 开始）",
    "en": "Restart numbering (from 1)"
  },
  "序号 {number}，设置编号": {
    "zh": "序号 {number}，设置编号",
    "en": "Number {number}; change numbering"
  },
  "链接类型": {
    "zh": "链接类型",
    "en": "Link type"
  },
  "图片来源": {
    "zh": "图片来源",
    "en": "Image source"
  },
  "清除样式": {
    "zh": "清除样式",
    "en": "Clear formatting"
  },
  "查找／替换": {
    "zh": "查找／替换",
    "en": "Find / replace"
  },
  "标题 {level}": {
    "zh": "标题 {level}",
    "en": "Heading {level}"
  },
  "正文": {
    "zh": "正文",
    "en": "Paragraph"
  },
  "无序列表": {
    "zh": "无序列表",
    "en": "Bullet list"
  },
  "有序列表": {
    "zh": "有序列表",
    "en": "Numbered list"
  },
  "引用": {
    "zh": "引用",
    "en": "Quote"
  },
  "代码块": {
    "zh": "代码块",
    "en": "Code block"
  },
  "分割线": {
    "zh": "分割线",
    "en": "Horizontal rule"
  },
  "链接": {
    "zh": "链接",
    "en": "Link"
  },
  "图片": {
    "zh": "图片",
    "en": "Image"
  },
  "删除链接": {
    "zh": "删除链接",
    "en": "Remove link"
  },
  "打开链接": {
    "zh": "打开链接",
    "en": "Open link"
  },
  "编辑链接": {
    "zh": "编辑链接",
    "en": "Edit link"
  },
  "关闭": {
    "zh": "关闭",
    "en": "Close"
  },
  "左对齐": {
    "zh": "左对齐",
    "en": "Align left"
  },
  "居中对齐": {
    "zh": "居中对齐",
    "en": "Align center"
  },
  "右对齐": {
    "zh": "右对齐",
    "en": "Align right"
  },
  "Select files...": {
    "zh": "选择文件…",
    "en": "Select files…"
  },
  "Select files to insert as attachments": {
    "zh": "选择文件作为附件插入",
    "en": "Select files to insert as attachments"
  },
  "Select images...": {
    "zh": "选择图片…",
    "en": "Select images…"
  },
  "Select image files to upload and insert into the editor": {
    "zh": "选择图片并插入文档",
    "en": "Select images to insert into the document"
  },
  "Open a Markdown file to edit": {
    "zh": "打开 Markdown 文件进行编辑",
    "en": "Open a Markdown file to edit"
  },
  "Select a .md file from the file explorer": {
    "zh": "从文件列表选择 .md 文件",
    "en": "Select a .md file from the file explorer"
  },
  "Loading preview...": {
    "zh": "正在加载预览…",
    "en": "Loading preview…"
  },
  "Empty note": {
    "zh": "空白笔记",
    "en": "Empty note"
  },
  "Rendering diagram...": {
    "zh": "正在绘制图表…",
    "en": "Rendering diagram…"
  },
  "Invalid Mermaid diagram": {
    "zh": "Mermaid 图表格式有误",
    "en": "Invalid Mermaid diagram"
  },
  "未找到：{target}": {
    "zh": "未找到：{target}",
    "en": "Not found: {target}"
  },
  "无法预览：{target}": {
    "zh": "无法预览：{target}",
    "en": "Preview unavailable: {target}"
  },
  "代码语言": {
    "zh": "代码语言",
    "en": "Code language"
  },
  "Copy code block": {
    "zh": "复制代码块",
    "en": "Copy code block"
  },
  "Copy": {
    "zh": "复制",
    "en": "Copy"
  },
  "Cut code block": {
    "zh": "剪切代码块",
    "en": "Cut code block"
  },
  "Cut": {
    "zh": "剪切",
    "en": "Cut"
  },
  "Block Image": {
    "zh": "独立图片",
    "en": "Block image"
  },
  "Inline Image": {
    "zh": "行内图片",
    "en": "Inline image"
  },
  "Small": {
    "zh": "小",
    "en": "Small"
  },
  "Medium": {
    "zh": "中",
    "en": "Medium"
  },
  "Large": {
    "zh": "大",
    "en": "Large"
  },
  "1/3 scale": {
    "zh": "三分之一大小",
    "en": "1/3 scale"
  },
  "1/2 scale": {
    "zh": "一半大小",
    "en": "1/2 scale"
  },
  "Full": {
    "zh": "原尺寸",
    "en": "Full"
  },
  "Full size": {
    "zh": "原始尺寸",
    "en": "Full size"
  },
  "16 pixels": {
    "zh": "16 像素",
    "en": "16 pixels"
  },
  "24 pixels": {
    "zh": "24 像素",
    "en": "24 pixels"
  },
  "32 pixels": {
    "zh": "32 像素",
    "en": "32 pixels"
  },
  "Plain text": {
    "zh": "纯文本",
    "en": "Plain text"
  },
  "C Like (C, C#, C++, Java)": {
    "zh": "C 系语言（C、C#、C++、Java）",
    "en": "C-like (C, C#, C++, Java)"
  },
  "Vault": {
    "zh": "本地库",
    "en": "Vault"
  }
} as const
export type Language = 'zh' | 'en'
export type TranslationKey = keyof typeof translations.en
export function resolveLanguage(value:string):Language { return /^zh(?:[-_]|$)/i.test(value) ? 'zh' : 'en' }
export function getLanguage():Language {
  try { const value=getObsidianLanguage?.();if(value)return resolveLanguage(value) }catch {}
  return resolveLanguage(typeof navigator==='undefined'?'en':navigator.language)
}
export function t(key:TranslationKey,language:Language=getLanguage()):string { return translations[language][key] }
export function ui(key:keyof typeof uiMessages,params:Record<string,string|number>={},language:Language=getLanguage()):string {
  return uiMessages[key][language].replace(/\{(\w+)\}/g,(match,key)=>key in params?String(params[key]):match)
}
export function r(value:string):string {
  return Object.keys(translations.en).find(key=>translations.en[key as TranslationKey]===value||translations.zh[key as TranslationKey]===value)||''
}
