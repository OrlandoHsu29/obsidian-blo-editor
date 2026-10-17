import { Editor, Element, Node, Path, Point, Range, Text, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'

/** Search rendered text across marks and inline links, never Markdown or void metadata. */
export function findText(editor: Editor, query: string, matchCase = false): Range[] {
  if (!query) return []
  const results: Range[] = []
  const needle = query
  for (const [block, path] of Editor.nodes(editor, {
    at: [], mode: 'lowest', match: node => Element.isElement(node) && Editor.isBlock(editor, node),
  })) {
    let parts: {text: string; path: Path}[] = []
    const flush = () => {
      const text = parts.map(part => part.text).join('')
      // RegExp /i keeps UTF-16 offsets stable for case folding (e.g. İ).
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, matchCase ? 'g' : 'gi')
      const point = (offset: number, end: boolean): Point => {
        for (let i=0;i<parts.length;i++) {
          if (offset < parts[i].text.length || (end && offset === parts[i].text.length) || i===parts.length-1) return {path:parts[i].path,offset}
          offset -= parts[i].text.length
        }
        throw new Error('Missing search text')
      }
      for (const hit of text.matchAll(regex)) results.push({anchor:point(hit.index!,false),focus:point(hit.index!+hit[0].length,true)})
      parts = []
    }
    const visit = (node: Node, at: Path) => {
      if (Text.isText(node)) { if (node.text) parts.push({text:node.text,path:at}); return }
      if (Element.isElement(node) && editor.isVoid(node)) { flush(); return }
      node.children.forEach((child,index)=>visit(child,[...at,index]))
    }
    visit(block,path); flush()
  }
  return results
}

export function replaceMatches(editor: Editor, ranges: Range[], replacement: string): number {
  if (editor.wysimark.readOnly || !ranges.length) return 0
  const run = () => Editor.withoutNormalizing(editor, () => {
    for (const range of [...ranges].reverse()) Transforms.insertText(editor,replacement,{at:range})
  })
  if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor,run)
  else run()
  return ranges.length
}
