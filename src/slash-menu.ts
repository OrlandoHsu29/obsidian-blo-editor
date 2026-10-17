import { ui } from "./wysimark/utils/translations"
import { Editor, Element, Node, Point, Range } from 'slate'

export function getSlashContext(editor: Editor) {
  if (editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return null
  if (Editor.above(editor, {match: node => Element.isElement(node) && node.type === 'code-block'})) return null
  const block = Editor.above(editor, {match: node => Element.isElement(node) && Editor.isBlock(editor, node)})
  if (!block || !Point.equals(editor.selection.focus, Editor.end(editor, block[1]))) return null
  const match = Node.string(block[0]).match(/^\s*\/([^/\n]*)$/)
  if (!match) return null
  return {query: match[1].trim(), range: Editor.range(editor, block[1]), key: JSON.stringify([block[1], match[1]])}
}

export function canOpenSlashMenu(editor: Editor): boolean {
  if (editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return false
  if (Editor.above(editor, {match: node => Element.isElement(node) && node.type === 'code-block'})) return false
  const block = Editor.above(editor, {match: node => Element.isElement(node) && Editor.isBlock(editor, node)})
  return !!block && /^\s*$/.test(Node.string(block[0]))
}

/** These use the same editor methods as the toolbar and formatting shortcuts. */
export const slashCommands: {title: string; icon: string; run: (editor: Editor) => void}[] = [
  {title: ui("正文"), icon: 'pilcrow', run: editor => editor.collapsibleParagraph.convertParagraph()},
  ...([1, 2, 3] as const).map(level => ({title: ui('标题 {level}',{level}), icon: `heading-${level}`, run: (editor: Editor) => editor.heading.convertHeading(level, false)})),
  {title: ui("无序列表"), icon: 'list', run: editor => editor.list.convertUnorderedList(true)},
  {title: ui("有序列表"), icon: 'list-ordered', run: editor => editor.list.convertOrderedList(true)},
  {title: ui("引用"), icon: 'quote', run: editor => editor.blockQuotePlugin.isActive() ? editor.blockQuotePlugin.outdent() : editor.blockQuotePlugin.indent()},
  {title: ui("代码块"), icon: 'code', run: editor => editor.codeBlock.toggleCodeBlock()},
  {title: ui("分割线"), icon: 'minus', run: editor => editor.horizontalRule.insertHorizontalRule()},
  {title: ui("字体颜色"), icon: 'palette', run: editor => editor.wysimark.openTextColor?.()},
]
