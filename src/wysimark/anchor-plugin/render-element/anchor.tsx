import React, { useCallback, useEffect, useRef } from "react"
import { Editor, Element, Path, Range } from "slate"
import { ReactEditor, useReadOnly, useSelected, useSlateSelector, useSlateStatic } from "slate-react"

import { ConstrainedRenderElementProps } from "../../sink"

import { isWikiLinkHref, wikiLinkSpecFromHref, wikiLinkTarget } from "../../convert/obsidian-links"
import { useLayer } from "../../use-layer"
import { AnchorElement } from "../index"
import { $Anchor, $Edge } from "../styles"
import { AnchorDialog } from "./AnchorDialog"
import { isIconOnlyLink, isLinkFullySelected, isLinkIconSelected, selectedLink } from '../link-keyboard'
import { consumePointerSelectionClick } from '../../../blocks/pointer-selection'
import { useSelectionBackground } from './use-selection-background'
function isPreciseLinkSelection(editor: Editor): boolean {
  const selection = editor.selection
  if (!selection) return false
  if (Range.isCollapsed(selection)) return true
  if (selectedLink(editor)) return true
  const cell = Editor.above(editor, { at: selection.anchor,
    match: node => Element.isElement(node) && node.type === 'table-cell' })?.[1]
  return !!cell && Path.isAncestor(cell, selection.focus.path) && Range.equals(selection, Editor.range(editor, cell))
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
  const selected = useSelected()
  const editor = useSlateStatic()
  const preciseSelection = useSlateSelector(isPreciseLinkSelection)
  const expandedSelection = useSlateSelector(editor => !!editor.selection && Range.isExpanded(editor.selection))
  const fullSelection = useSlateSelector(useCallback(editor => {
    try { return isLinkFullySelected(editor, ReactEditor.findPath(editor, element)) }
    catch { return false }
  }, [element]))
  const iconSelection = useSlateSelector(useCallback(editor => {
    try { return isLinkIconSelected(editor, ReactEditor.findPath(editor, element)) }
    catch { return false }
  }, [element]))
  const selectionBackground = useSelectionBackground(element, fullSelection)
  const dialog = useLayer("dialog")
  const dialogRef = useRef(dialog)
  const ownedDialog = useRef<React.FunctionComponent<Record<string, never>> | null>(null)
  dialogRef.current = dialog
  const isInternalLink = isWikiLinkHref(element.href)
  const iconOnly = isIconOnlyLink(element)
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
      className={selected ? '--selected' : undefined}
      href={isInternalLink ? undefined : element.href}
      target={isInternalLink ? undefined : element.target}
      draggable={false}
      data-internal-link={isInternalLink ? "true" : undefined}
      data-link-icon="true"
      data-link-icon-only={iconOnly ? "true" : undefined}
      data-link-expanded={expandedSelection ? "true" : undefined}
      data-link-full={fullSelection ? "true" : undefined}
      data-link-icon-selected={iconSelection ? "true" : undefined}
      data-link-text-selected={selectionBackground ? "true" : undefined}
      data-link-precise={!readOnly && selected && preciseSelection ? "true" : undefined}
      onMouseDown={event => {
        if (readOnly || event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopPropagation() }
      }}
      onClick={event => {
        event.preventDefault()
        if (consumePointerSelectionClick(editor)) { event.stopPropagation(); return }
        if (!(readOnly || event.ctrlKey || event.metaKey || event.detail === 0)) return
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
      <span className="wysimark-link-icon" contentEditable={false} aria-hidden="true" />
      <span className="wysimark-link-label" style={selectionBackground}>{children}</span>
      <$Edge contentEditable={false} />
    </$Anchor>
  )
}
