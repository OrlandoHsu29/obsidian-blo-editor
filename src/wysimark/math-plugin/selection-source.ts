import { Editor, Text } from 'slate'
import type { Descendant } from 'slate'

/** Void formula leaves are empty; their actual content lives in `latex`. */
export function mathSelectionSource(editor: Editor): string {
  if (!editor.selection) return ''
  const source = (node: Descendant): string => {
    if (Text.isText(node)) return node.text
    if (node.type === 'math-inline' || node.type === 'math-block') return node.latex
    return (node.children as Descendant[]).map(source).join('')
  }
  return Editor.fragment(editor, editor.selection).map(source).join('\n')
}
