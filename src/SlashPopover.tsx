import { ui } from "./wysimark/utils/translations"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDefaultIntegrations, subscribeDefaultIntegrations } from './integration-preferences'
import { createPortal } from 'react-dom'
import { Editor, Transforms } from 'slate'
import type { RangeRef } from 'slate'
import { ReactEditor, useSlate } from 'slate-react'
import { useEditorFocused } from './wysimark/entry/use-editor-focused'
import { getSlashContext, filterSlashCommands } from './slash-menu'
import { AnchorDialog, AttachmentInsertDialog } from './wysimark/toolbar-plugin/components/dialog/anchor-dialog'
import { useBlockToolbarPosition } from './wysimark/use-reposition/hooks/use-block-toolbar-position'

export function SlashPopover() {
  const editor = useSlate(), focused = useEditorFocused(editor)
  /** The editor's own document; a popout such as the quick memo panel is separate. */
  const editorDocument = () => {
    try { return ReactEditor.toDOMNode(editor, editor).ownerDocument } catch { return document }
  }
  const preferences = editor.wysimark.integrationPreferences
  const integrations = useSyncExternalStore(preferences?.subscribe ?? subscribeDefaultIntegrations, preferences?.getSnapshot ?? getDefaultIntegrations)
  const [dialog, setDialog] = useState<{kind: 'link' | 'attachment'; range: RangeRef} | null>(null)
  const context = focused && !dialog ? getSlashContext(editor) : null
  const [dismissed, setDismissed] = useState('')
  const [choice, setChoice] = useState({key: '', index: 0})
  const popup = useRef<HTMLDivElement>(null)
  const matches = filterSlashCommands(context?.query || '', integrations.drawings)
  const visible = !!context && context.key !== dismissed && matches.length > 0
  const selected = choice.key === context?.key ? Math.min(choice.index, matches.length - 1) : 0
  const choose = (index: number) => {
    if (!context || !matches[index]) return
    const command = matches[index]
    Editor.withoutNormalizing(editor, () => {
      Transforms.select(editor, context.range)
      Transforms.delete(editor)
      command.run?.(editor)
    })
    if (command.dialog && editor.selection) setDialog({kind: command.dialog, range: Editor.rangeRef(editor, editor.selection)})
    else ReactEditor.focus(editor)
  }
  const closeDialog = () => { setDialog(null); ReactEditor.focus(editor) }
  useEffect(() => () => { dialog?.range.unref() }, [dialog])
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
  let editable: HTMLElement | null = null
  try { editable = ReactEditor.toDOMNode(editor, editor) } catch { /* The editor has not mounted yet. */ }
  const caretRect = useCallback(() => ReactEditor.toDOMRange(editor, editor.selection!).getBoundingClientRect(), [editor])
  const dialogRect = useCallback(() => ReactEditor.toDOMRange(editor, dialog!.range.current!).getBoundingClientRect(), [editor, dialog])
  const position = useBlockToolbarPosition(editable, popup, { active: visible, getAnchorRect: caretRect, allowResize: true, maxHeight: 280, aboveGap: 12, belowGap: 12,
    close: () => { if (context) setDismissed(context.key) } })
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
      {editable && <Dialog dest={editable} getAnchorRect={dialogRect} close={closeDialog} />}
    </div>, ReactEditor.toDOMNode(editor, editor).ownerDocument.body)
  }
  if (!visible) return null
  return createPortal(<div ref={popup} className="wysimark-slash-popover" role="listbox" aria-label={ui("简洁命令菜单")} style={{position:'fixed', boxSizing:'border-box', left:position.left, top:position.top, maxWidth:position.maxWidth, maxHeight:position.maxHeight, visibility:position.visible?'visible':'hidden'}} onMouseDown={event => event.preventDefault()}>
    {matches.map((command, index) => <div key={command.title} role="option" aria-selected={index === selected} className={index === selected ? 'is-selected' : ''} onMouseEnter={() => setChoice({key:context!.key,index})} onClick={() => choose(index)}>{command.title}</div>)}
  </div>, editorDocument().body)
}
