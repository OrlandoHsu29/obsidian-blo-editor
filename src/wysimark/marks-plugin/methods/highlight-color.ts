import { Editor, Node, Range, Text, Transforms } from 'slate'
import { withHistoryBatch } from '../../utils/with-history-batch'
import { cleanInlineStyle } from '../../../blocks/typography'
import { mappedTextColors, TEXT_COLORS } from '../../../blocks/colors'
import { formatSelectedTableCells, selectedCellTextEntries, tableCellSelection } from '../../table-plugin/cell-selection'

export const DEFAULT_HIGHLIGHT_COLOR = '#FFD000'
export const HIGHLIGHT_COLORS = [DEFAULT_HIGHLIGHT_COLOR, TEXT_COLORS.red, TEXT_COLORS.orange, TEXT_COLORS.green, TEXT_COLORS.blue, TEXT_COLORS.purple]
export function highlightBackground(color: string): string {
  return color === DEFAULT_HIGHLIGHT_COLOR ? 'var(--text-highlight-bg, rgba(255, 208, 0, 0.4))' : mappedTextColors(color).background ?? color
}
function styleWithHighlight(style: string | undefined, color: string | null): string {
  const other = (cleanInlineStyle(style) ?? '').split(';').filter(part => part && !part.startsWith('background-color:'))
  if (color && color !== DEFAULT_HIGHLIGHT_COLOR) other.push('background-color:' + highlightBackground(color))
  return other.join(';')
}
export function applyHighlightColor(editor: Editor, color: string | null): void {
  if (!editor.selection || editor.wysimark.readOnly) return
  if (color && !HIGHLIGHT_COLORS.includes(color)) return
  withHistoryBatch(editor, () => {
    const update = (leaf: Partial<Text>, at: Parameters<typeof Transforms.setNodes>[2]) => {
      const style = styleWithHighlight(leaf.inlineStyle, color)
      Transforms.setNodes(editor, { highlight: color ? true : undefined, inlineStyle: style || undefined }, at)
    }
    if (formatSelectedTableCells(editor, selected => {
      for (const [leaf, path] of selectedCellTextEntries(editor, selected)) update(leaf, { at: path })
    })) return
    if (Range.isCollapsed(editor.selection!)) {
      const style = styleWithHighlight(Editor.marks(editor)?.inlineStyle, color)
      if (color) Editor.addMark(editor, 'highlight', true); else Editor.removeMark(editor, 'highlight')
      if (style) Editor.addMark(editor, 'inlineStyle', style); else Editor.removeMark(editor, 'inlineStyle')
      if (!color && editor.activeMarks) delete editor.activeMarks.highlight
      return
    }
    const selection = editor.selection!
    Editor.withoutNormalizing(editor, () => {
      for (const [leaf, path] of [...Editor.nodes<Text>(editor, { at: selection, match: Text.isText })].reverse()) {
        if (Editor.above(editor, { at: path, match: n => !Text.isText(n) && 'type' in n && n.type === 'code-block' })) continue
        const at = Range.intersection(selection, Editor.range(editor, path))
        if (at && Range.isExpanded(at)) update(leaf, { at, match: Text.isText, split: true })
      }
    })
  })
}
export function toggleHighlightColor(editor: Editor): void {
  if (!editor.selection || editor.wysimark.readOnly) return
  const cells = tableCellSelection(editor)
  const leaves = cells ? selectedCellTextEntries(editor, cells).map(([leaf]) => leaf).filter(leaf => leaf.text.length)
    : Range.isExpanded(editor.selection) ? Editor.fragment(editor, editor.selection).flatMap(n => [...Node.texts(n)].map(([leaf]) => leaf)).filter(leaf => leaf.text.length)
      : [Editor.marks(editor) ?? {}]
  applyHighlightColor(editor, leaves.length && leaves.every(leaf => leaf.highlight)
    ? null : editor.wysimark.getHighlightColor?.() ?? DEFAULT_HIGHLIGHT_COLOR)
}
