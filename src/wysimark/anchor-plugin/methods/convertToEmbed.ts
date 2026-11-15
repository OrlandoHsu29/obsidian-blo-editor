import { Editor, Element, Node, Transforms } from "slate"

import { BetterAt, findElementUp } from "../../sink"
import { wikiEmbedUrl } from "../../convert/obsidian-links"
import { convertInlineImageAtPath } from '../../image-plugin/render-element/image-with-controls/image-toolbar/image-type-buttons/convert-to-block-image'

/**
 * Replace the anchor at `at` with an internal embed (`![[spec]]`), rendered as
 * a standalone media block whose url is a `wysimark:wiki-embed:` URL.
 */
export function convertToEmbed(
  editor: Editor,
  spec: string,
  { at }: { at?: BetterAt }
) {
  const link = findElementUp(editor, "anchor", { at })
  if (!link) return false
  const [, path] = link
  Editor.withoutNormalizing(editor, () => {
    Transforms.removeNodes(editor, { at: path })
    Transforms.insertNodes(
      editor,
      {
        type: "image-inline",
        url: editor.wysimark.resolveInternalMedia?.(spec) || wikiEmbedUrl(spec),
        alt: spec,
        children: [{ text: "" }],
      },
      { at: path }
    )
    const parent = Node.parent(editor, path)
    if (Element.isElement(parent) && parent.type !== 'table-content') convertInlineImageAtPath(editor, path)
  })
  return true
}
