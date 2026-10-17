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

type SlashCommand = {
  title: string
  searchTerms: string[]
  icon: string
  run: (editor: Editor) => void
}

const normalizeSearch = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g, '')

function command(label: Parameters<typeof ui>[0], icon: string, run: SlashCommand['run'], params: Record<string, string | number> = {}, aliases: string[] = []): SlashCommand {
  return {
    title: ui(label, params),
    searchTerms: [ui(label, params, 'zh'), ui(label, params, 'en'), ...aliases].map(normalizeSearch),
    icon,
    run,
  }
}

/** Search translated names, common aliases, and Chinese pinyin initials. */
export function filterSlashCommands(query: string): SlashCommand[] {
  const search = normalizeSearch(query)
  return slashCommands.filter(command => command.searchTerms.some(name => name.includes(search)))
}

/** These use the same editor methods as the toolbar and formatting shortcuts. */
export const slashCommands: SlashCommand[] = [
  command('正文', 'pilcrow', editor => editor.collapsibleParagraph.convertParagraph(), {}, ['zw']),
  ...([1, 2, 3] as const).map(level => command('标题 {level}', `heading-${level}`, editor => editor.heading.convertHeading(level, false), {level}, [`bt${level}`])),
  command('无序列表', 'list', editor => editor.list.convertUnorderedList(true), {}, ['wxlb']),
  command('有序列表', 'list-ordered', editor => editor.list.convertOrderedList(true), {}, ['yxlb']),
  command('引用', 'quote', editor => editor.blockQuotePlugin.isActive() ? editor.blockQuotePlugin.outdent() : editor.blockQuotePlugin.indent(), {}, ['yy']),
  command('代码块', 'code', editor => editor.codeBlock.toggleCodeBlock(), {}, ['dmk']),
  command('分割线', 'minus', editor => editor.horizontalRule.insertHorizontalRule(), {}, ['Divider', 'Separator', '分隔线', 'fgx']),
  command('字体颜色', 'palette', editor => editor.wysimark.openTextColor?.(), {}, ['ztys', 'ys']),
]