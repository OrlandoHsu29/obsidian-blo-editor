import { Editor, Element, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import { isWikiEmbedUrl, splitWikiSpec, wikiEmbedSpecFromUrl, wikiEmbedUrl } from './wysimark/convert/obsidian-links'
import type { ImageBlockElement, ImageInlineElement } from './wysimark/image-plugin/types'

/** Bind to a Slate path, so edits cannot drift to another image after a render. */
export function imageDescriptionTarget(editor: Editor, source: HTMLImageElement) {
  if (editor.wysimark.readOnly || !ReactEditor.toDOMNode(editor, editor).contains(source)) return
  const node = ReactEditor.toSlateNode(editor, source)
  if (!Element.isElement(node) || (node.type !== 'image-block' && node.type !== 'image-inline')) return
  const wiki = isWikiEmbedUrl(node.url) ? splitWikiSpec(wikiEmbedSpecFromUrl(node.url)) : undefined
  // A picture inside an embedded note belongs to that note, not to its embed block.
  if (wiki && !/\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(wiki.target)) return
  const ref = Editor.pathRef(editor, ReactEditor.findPath(editor, node))
  const original = wiki ? (wiki.display && !/^\d+(?:x\d+)?$/.test(wiki.display) ? wiki.display : '') : node.title || node.alt || ''
  return {
    value: original,
    dispose: () => ref.unref(),
    save(value: string) {
      if (!ref.current || editor.wysimark.readOnly) return false
      const current = Editor.node(editor, ref.current)[0] as ImageBlockElement | ImageInlineElement
      if (current.type !== node.type || current.url !== node.url) return false
      const description = value.trim()
      if (description === original) return true
      const update: Partial<ImageBlockElement | ImageInlineElement> = { alt: description, title: description }
      if (wiki) {
        update.url = wikiEmbedUrl(wiki.target + (description ? `|${description}` : ''))
        // Numeric wiki aliases encode dimensions; preserve them when adding a description.
        if (wiki.display && /^\d+(?:x\d+)?$/.test(wiki.display)) {
          const [width, height] = wiki.display.split('x').map(Number)
          update.width = current.width || width
          if (height) update.height = current.height || height
        }
      }
      const apply = () => Transforms.setNodes(editor, update, { at: ref.current! })
      if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
      else apply()
      return true
    },
  }
}
