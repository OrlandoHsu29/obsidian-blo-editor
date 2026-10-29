import { createPortal } from "react-dom"
import { ReactEditor, useSlateStatic } from 'slate-react'

/**
 * Portal to the active document body.
 *
 * NOTE:
 * Consider creating a version of Portal with a Reset in it.
 *
 * The reason is that when showing a portal, it will carry the baggage of
 * any styling from `<html>` and `<body>` element.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const editor = useSlateStatic()
  let doc: Document | undefined
  try { doc = ReactEditor.toDOMNode(editor, editor).ownerDocument } catch { if (typeof activeDocument !== 'undefined') doc = activeDocument }
  if (!doc?.body) return null
  return createPortal(<div className="wysimark-overlay">{children}</div>, doc.body)
}
