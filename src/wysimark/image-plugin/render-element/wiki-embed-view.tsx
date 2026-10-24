import styled from "@emotion/styled"
import { Fragment, useCallback, useEffect, useRef } from "react"
import { Transforms } from "slate"
import { ReactEditor, useSelected, useSlate } from "slate-react"

import { wikiEmbedSpecFromUrl, wikiLinkTarget } from "../../convert/obsidian-links"
import { AnchorDialog } from "../../anchor-plugin/render-element/AnchorDialog"
import { AnchorEditDialog } from "../../anchor-plugin/render-element/AnchorEditDialog"
import { useLayer } from "../../use-layer"
import { ImageBlockElement, ImageInlineElement } from "../types"
import { useAttachmentRevision } from '../attachment-revision'

const $WikiEmbed = styled("span")`
  position: relative;
  display: inline-block;
  &[data-wysimark-embed-block] { display: block; max-width: 100%; }
`

/**
 * Renders a wiki embed (`![[spec]]`) using the host's `renderInternalEmbed`.
 * When the embed is selected, a small toolbar lets the user edit it (convert
 * back to a link so the anchor edit dialog can take over) or remove it.
 */
export function WikiEmbedView({
  element,
}: {
  element: ImageInlineElement | ImageBlockElement
}) {
  const editor = useSlate()
  const revision = useAttachmentRevision(editor, element.url)
  const selected = useSelected()
  const dialog = useLayer("dialog")
  const embedRef = useRef<HTMLSpanElement>(null)
  const startEdgeRef = useRef<HTMLSpanElement>(null)
  const renderInternalEmbed = editor.wysimark.renderInternalEmbed
  const spec = wikiEmbedSpecFromUrl(element.url)

  const handleEdit = useCallback(() => {
    const fallbackAnchor = embedRef.current
    const fallbackStartEdge = startEdgeRef.current
    if (!fallbackAnchor || !fallbackStartEdge) return
    const at = ReactEditor.findPath(editor, element)
    const result = editor.anchor.convertToLink(spec, { at })
    if (!result) return
    const [anchor] = result
    window.setTimeout(() => {
      let anchorNode: HTMLElement = fallbackAnchor
      try {
        anchorNode = ReactEditor.toDOMNode(editor, anchor)
      } catch {
        /* Fall back to the embed position if React has not rendered the anchor yet. */
      }
      const startEdge =
        anchorNode.querySelector<HTMLElement>('[contenteditable="false"]') ||
        fallbackStartEdge
      dialog.open(() => (
        <AnchorEditDialog
          destAnchor={anchorNode}
          destStartEdge={startEdge}
          element={anchor}
          initialEmbed
          onCancel={() => {
            editor.anchor.convertToEmbed(spec, { at: anchor })
            dialog.close()
          }}
        />
      ))
    })
  }, [dialog, editor, element, spec])

  const handleRemove = useCallback(() => {
    const at = ReactEditor.findPath(editor, element)
    Transforms.removeNodes(editor, { at })
  }, [editor, element])

  useEffect(() => {
    const anchor = embedRef.current
    const startEdge = startEdgeRef.current
    if (!anchor || !startEdge) return
    const hasSelection =
      editor.selection &&
      editor.selection.anchor.offset !== editor.selection.focus.offset
    // Drawings provide their own edit control rather than a link popover.
    if (selected && !hasSelection && !anchor.querySelector('[data-blo-drawing],[data-blo-video]')) {
      window.setTimeout(() => {
        dialog.open(() => (
          <AnchorDialog
            destAnchor={anchor}
            destStartEdge={startEdge}
            embed={{
              target: wikiLinkTarget(spec),
              onEdit: handleEdit,
              onRemove: handleRemove,
            }}
          />
        ))
      })
    } else {
      dialog.close()
    }
  }, [selected, spec])

  return (
    <$WikiEmbed ref={embedRef} contentEditable={false} data-wysimark-embed-block={element.type === 'image-block' || undefined}>
      <span ref={startEdgeRef} style={{ display: "none" }} />
      <Fragment key={revision}>{renderInternalEmbed?.(spec)}</Fragment>
    </$WikiEmbed>
  )
}
