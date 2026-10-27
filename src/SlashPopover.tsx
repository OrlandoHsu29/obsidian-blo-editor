import { ui } from "./wysimark/utils/translations"
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDefaultIntegrations, subscribeDefaultIntegrations } from './integration-preferences'
import { createPortal } from 'react-dom'
import { Editor, Transforms } from 'slate'
import { ReactEditor, useSlate } from 'slate-react'
import { useEditorFocused } from './wysimark/entry/use-editor-focused'
import { getSlashContext, filterSlashCommands } from './slash-menu'
import { AnchorDialog, AttachmentInsertDialog } from './wysimark/toolbar-plugin/components/dialog/anchor-dialog'

export function SlashPopover() {
  const editor = useSlate(), focused = useEditorFocused(editor)
  /** The editor's own document; a popout such as the quick memo panel is separate. */
  const editorDocument = () => {
    try { return ReactEditor.toDOMNode(editor, editor).ownerDocument } catch { return document }
  }
  const preferences = editor.wysimark.integrationPreferences
  const integrations = useSyncExternalStore(preferences?.subscribe ?? subscribeDefaultIntegrations, preferences?.getSnapshot ?? getDefaultIntegrations)
  const [dialog, setDialog] = useState<{kind: 'link' | 'attachment'; left: number; top: number; height: number} | null>(null)
  const [dialogAnchor, setDialogAnchor] = useState<HTMLSpanElement | null>(null)
  const context = focused && !dialog ? getSlashContext(editor) : null
  const [dismissed, setDismissed] = useState('')
  const [choice, setChoice] = useState({key: '', index: 0})
  const popup = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({left: 0, top: 0, maxHeight: 280})
  const matches = filterSlashCommands(context?.query || '', integrations.drawings)
  const visible = !!context && context.key !== dismissed && matches.length > 0
  const selected = choice.key === context?.key ? Math.min(choice.index, matches.length - 1) : 0
  const choose = (index: number) => {
    if (!context || !matches[index]) return
    const command = matches[index]
    const rect = command.dialog ? ReactEditor.toDOMRange(editor, editor.selection!).getBoundingClientRect() : null
    Editor.withoutNormalizing(editor, () => {
      Transforms.select(editor, context.range)
      Transforms.delete(editor)
      command.run?.(editor)
    })
    if (command.dialog && rect) setDialog({kind: command.dialog, left: rect.left, top: rect.top, height: rect.height})
    else ReactEditor.focus(editor)
  }
  const closeDialog = () => { setDialog(null); ReactEditor.focus(editor) }
  useEffect(() => {
    if (!dialog) return
    const doc = ReactEditor.toDOMNode(editor, editor).ownerDocument
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault(); event.stopImmediatePropagation(); closeDialog()
    }
    doc.addEventListener('keydown', closeOnEscape, true)
    return () => doc.removeEventListener('keydown', closeOnEscape, true)
  }, [dialog, editor])
  useLayoutEffect(() => {
    if (!visible || !editor.selection) return
    const doc = editorDocument()
    const win = doc.defaultView ?? window
    const update = () => {
      try {
        if (!popup.current || !editor.selection) return
        const rect = ReactEditor.toDOMRange(editor, editor.selection).getBoundingClientRect()
        const menu = popup.current
        const gap = 12, edge = 8
        // Measure rendered content instead of guessing option heights or shifting
        // a below-caret menu upward through the current line.
        const naturalHeight = Math.min(menu.scrollHeight + menu.offsetHeight - menu.clientHeight, 280)
        const above = Math.max(0, rect.top - gap - edge)
        const below = Math.max(0, win.innerHeight - rect.bottom - gap - edge)
        const placeAbove = above >= naturalHeight || above >= below
        const maxHeight = Math.min(naturalHeight, placeAbove ? above : below)
        const width = menu.getBoundingClientRect().width
        const left = Math.max(edge, Math.min(rect.left, win.innerWidth - width - edge))
        const top = placeAbove ? rect.top - gap - maxHeight : rect.bottom + gap
        setPosition({left, top, maxHeight})
      } catch { /* Wait for Slate's DOM selection to update. */ }
    }
    update()
    doc.addEventListener('scroll', update, true)
    win.addEventListener('resize', update)
    return () => { doc.removeEventListener('scroll', update, true); win.removeEventListener('resize', update) }
  }, [visible, context?.key])
  useEffect(() => {
    if (!visible) return
    const doc = editorDocument()
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || !ReactEditor.toDOMNode(editor, editor).contains(event.target as globalThis.Node)) return
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) return
      event.preventDefault(); event.stopImmediatePropagation()
      if (event.key === 'Escape') setDismissed(context!.key)
      else if (event.key === 'Enter') choose(selected)
      else setChoice({key: context!.key, index: (selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length})
    }
    doc.addEventListener('keydown', onKey, true)
    return () => doc.removeEventListener('keydown', onKey, true)
  }, [visible, context?.key, selected])
  if (dialog) {
    const Dialog = dialog.kind === 'attachment' ? AttachmentInsertDialog : AnchorDialog
    return createPortal(<div className="wysimark-overlay">
      <span ref={setDialogAnchor} aria-hidden="true" style={{position:'fixed',left:dialog.left,top:dialog.top,width:0,height:dialog.height,pointerEvents:'none'}} />
      {dialogAnchor && <Dialog dest={dialogAnchor} close={closeDialog} />}
    </div>, ReactEditor.toDOMNode(editor, editor).ownerDocument.body)
  }
  if (!visible) return null
  return createPortal(<div ref={popup} className="wysimark-slash-popover" role="listbox" aria-label={ui("简洁命令菜单")} style={{position:'fixed', boxSizing:'border-box', maxWidth:'calc(100vw - 16px)', ...position}} onMouseDown={event => event.preventDefault()}>
    {matches.map((command, index) => <div key={command.title} role="option" aria-selected={index === selected} className={index === selected ? 'is-selected' : ''} onMouseEnter={() => setChoice({key:context!.key,index})} onClick={() => choose(index)}>{command.title}</div>)}
  </div>, editorDocument().body)
}
