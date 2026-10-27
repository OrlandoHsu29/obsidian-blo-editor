import { clsx } from "clsx"
import React, { useCallback, useEffect, useRef } from "react"
import { Editor, Element, Path, Range } from "slate"
import { useReadOnly, useSelected, useSlateSelector, useSlateStatic } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"

import { isWikiLinkHref, wikiLinkSpecFromHref, wikiLinkTarget } from "../../convert/obsidian-links"
import { useLayer } from "../../use-layer"
import { AnchorElement } from "../index"
import { $Anchor, $Edge } from "../styles"
import { AnchorDialog } from "./AnchorDialog"

function isPreciseLinkSelection(editor: Editor): boolean {
  const selection = editor.selection
  if (!selection) return false
  if (Range.isCollapsed(selection)) return true
  const link = Editor.above(editor, { at: selection.anchor, match: node => Element.isElement(node) && node.type === 'anchor' })
  if (link && Range.equals(Editor.range(editor, link[1]), { anchor: Range.start(selection), focus: Range.end(selection) })) return true
  const anchorCell = Editor.above(editor, {
    at: selection.anchor, match: node => Element.isElement(node) && node.type === 'table-cell',
  })?.[1]
  return !!anchorCell && Path.isAncestor(anchorCell, selection.focus.path) &&
    Range.equals(selection, Editor.range(editor, anchorCell))
}

export function Anchor({
  element,
  attributes,
  children,
}: ConstrainedRenderElementProps<AnchorElement>) {
  const startEdgeRef = useRef<HTMLSpanElement>(null)
  const anchorRef = useRef<HTMLAnchorElement>(null)
  const setAnchorRef = useCallback((node: HTMLAnchorElement | null) => {
    anchorRef.current = node
    attributes.ref(node)
  }, [attributes.ref])
  const clickIntent = useRef<{ open: boolean; x: number; y: number } | null>(null)
  const selected = useSelected()
  const editor = useSlateStatic()
  const preciseSelection = useSlateSelector(isPreciseLinkSelection)
  const dialog = useLayer("dialog")
  const dialogRef = useRef(dialog)
  const ownedDialog = useRef<React.FunctionComponent<Record<string, never>> | null>(null)
  dialogRef.current = dialog
  const isInternalLink = isWikiLinkHref(element.href)
  const readOnly = useReadOnly()

  useEffect(() => {
    const anchor = anchorRef.current
    const startEdge = startEdgeRef.current
    if (!anchor || !startEdge) return
    const closeOwned = () => {
      if (ownedDialog.current && dialogRef.current.layer?.Component === ownedDialog.current) dialogRef.current.close()
      ownedDialog.current = null
    }
    // Dialog focus must not dismiss a selected link's information card.
    // A rectangular table selection may cross this link without selecting its cell.
    if (readOnly || !selected || !preciseSelection) { closeOwned(); return }
    // Defer opening until Slate's DOM selection has settled.
    const win = anchor.ownerDocument.defaultView!
    const timer = win.setTimeout(() => {
      const card: React.FunctionComponent<Record<string, never>> = () => (
        <AnchorDialog destAnchor={anchor} destStartEdge={startEdge} element={element} />
      )
      ownedDialog.current = card
      dialogRef.current.open(card)
    })
    return () => { win.clearTimeout(timer); closeOwned() }
  }, [selected, preciseSelection, element, readOnly])

  return (
    <$Anchor
      className={clsx({
        "--selected": selected,
        "--internal-link": isInternalLink,
      })}
      href={isInternalLink ? undefined : element.href}
      target={isInternalLink ? undefined : element.target}
      data-internal-link={isInternalLink ? "true" : undefined}
      onMouseDown={event => {
        // Remember selection before Slate moves the caret on this mousedown.
        clickIntent.current = { open: readOnly || event.ctrlKey || event.metaKey || selected && preciseSelection, x: event.clientX, y: event.clientY }
        if (readOnly || event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopPropagation() }
      }}
      onClick={event => {
        event.preventDefault()
        const intent = clickIntent.current
        clickIntent.current = null
        const clickWithoutDragging = intent?.open && Math.hypot(event.clientX - intent.x, event.clientY - intent.y) <= 4
        if (!(readOnly || event.ctrlKey || event.metaKey || event.detail === 0 || clickWithoutDragging)) return
        event.stopPropagation()
        dialog.close()
        if (isInternalLink) {
          void editor.wysimark.openInternalLink?.(wikiLinkTarget(wikiLinkSpecFromHref(element.href)), event.ctrlKey || event.metaKey)
        } else if (!/^\s*(?:javascript|data|vbscript):/i.test(element.href)) {
          event.currentTarget.ownerDocument.defaultView?.open(element.href, element.target || '_blank', 'noopener,noreferrer')
        }
      }}
      {...attributes}
      ref={setAnchorRef}
    >
      {/* Edge allow Chrome to differentiate in/out of the link */}
      <$Edge ref={startEdgeRef} contentEditable={false} />
      <span>{children}</span>
      {/* Edge allow Chrome to differentiate in/out of the link */}
      <$Edge contentEditable={false} />
    </$Anchor>
  )
}
