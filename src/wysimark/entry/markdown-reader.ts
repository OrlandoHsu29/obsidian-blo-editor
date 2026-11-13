import type { Editor } from 'slate'
import { serialize } from '../convert'
import type { Element } from './plugins'

/** Slate replaces children on content changes; selection changes keep it intact.
 * Retain only the latest result so callbacks and saving share serialization.
 */
export function createMarkdownReader(editor: Pick<Editor, 'children'>, convert = serialize) {
  let children: Editor['children'] | undefined
  let markdown = ''
  return () => {
    if (children !== editor.children) {
      const next = convert(editor.children as Element[])
      children = editor.children
      markdown = next
    }
    return markdown
  }
}
