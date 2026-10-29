import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Editor, Element, Node } from 'slate'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { clipboardMediaLink, createMediaLinkImport, createMediaUrlPaste } from './media-url-paste'
import type { MediaUrlPaste } from './media-url-paste'
import { clipboardWebLink, createWebUrlPaste } from './web-link-paste'
import type { WebUrlPaste } from './web-link-paste'
import type { AnchorElement } from './wysimark/anchor-plugin'
import { Notice, setTooltip } from 'obsidian'
import { Link, ImportEmbed } from './wysimark/toolbar-plugin/icons'
import { useLayer } from './wysimark/use-layer'
import { $Panel } from './wysimark/shared-overlays'
import { useAnchoredPanelPosition } from './wysimark/use-reposition/hooks/use-block-toolbar-position'
import { ui } from './wysimark/utils/translations'
import { PageTitleIcon } from './wysimark/anchor-plugin/render-element/icons'

type PasteSession = MediaUrlPaste | WebUrlPaste
const isWebSession = (session: PasteSession): session is WebUrlPaste => 'kind' in session && session.kind === 'web'

function MediaImportActions({ session, close, compact = false }: { session: MediaUrlPaste; close: () => void; compact?: boolean }) {
  const editor = useSlateStatic()
  const embedButton = useRef<HTMLButtonElement>(null)
  const embedLabel = ui('下载为附件并嵌入')
  useLayoutEffect(() => {
    if (compact && embedButton.current) setTooltip(embedButton.current, embedLabel, {
      delay: 150, placement: 'top', gap: 8, classes: ['blo-media-import-tooltip'],
    })
  }, [compact, embedLabel])
  const dismiss = () => { session.dispose(); close() }
  const embed = () => {
    const importing = session.embed()
    dismiss()
    ReactEditor.focus(editor)
    void importing.catch(cause => {
      console.error('Blo Editor: media link import failed', cause)
      new Notice(ui('导入失败，已保留原链接。'))
    })
  }
  return <div className={`wysimark-media-import-actions${compact ? ' is-compact' : ''}`}>
    {!compact && <button type="button" role="menuitemradio" aria-checked={true} onClick={() => { dismiss(); ReactEditor.focus(editor) }}><Link /><span>{ui('保留文本链接')}</span></button>}
    <button ref={embedButton} type="button" role={compact ? undefined : 'menuitem'} disabled={!session.canEmbed}
      className={compact ? 'wysimark-media-import-icon' : undefined}
      aria-label={compact ? embedLabel : undefined} data-tooltip-position={compact ? 'top' : undefined}
      onClick={embed}><ImportEmbed />{!compact && <span>{embedLabel}</span>}</button>
  </div>
}

export function MediaLinkActions({ element, close }: { element: AnchorElement; close: () => void }) {
  const editor = useSlateStatic(), [session, setSession] = useState<MediaUrlPaste>()
  useEffect(() => {
    const next = createMediaLinkImport(editor, ReactEditor.findPath(editor, element), element.href)
    setSession(next)
    return () => next.dispose()
  }, [editor, element])
  return session ? <div className="wysimark-selected-media-actions">
    <MediaImportActions session={session} close={close} compact />
  </div> : null
}

function MediaPasteMenu({ session, host, close }: { session: PasteSession; host: HTMLElement; close: () => void }) {
  const editor = useSlateStatic(), ref = useRef<HTMLDivElement>(null)
  const dismissed = useRef(false)
  const dismiss = () => { if (!dismissed.current) { dismissed.current = true; session.dispose(); close() } }
  useEffect(() => {
    const initial = ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ?? ref.current?.querySelector('button')
    initial?.focus({ preventScroll: true })
    const win = host.ownerDocument.defaultView
    const doc = host.ownerDocument
    const outside = (event: Event) => { if (!ref.current?.contains(event.target as globalThis.Node)) dismiss() }
    win?.addEventListener('blur', dismiss)
    doc.addEventListener('pointerdown', outside, true)
    doc.addEventListener('focusin', outside, true)
    doc.addEventListener('scroll', outside, true)
    win?.addEventListener('scroll', dismiss)
    return () => {
      win?.removeEventListener('blur', dismiss)
      win?.removeEventListener('scroll', dismiss)
      doc.removeEventListener('pointerdown', outside, true)
      doc.removeEventListener('focusin', outside, true)
      doc.removeEventListener('scroll', outside, true)
      session.dispose()
    }
  }, [session])
  const anchorRect = useCallback(() => {
    if (!session.path.current) return host.getBoundingClientRect()
    const dom = ReactEditor.toDOMNode(editor, Editor.node(editor, session.path.current)[0]), rects = dom.getClientRects()
    return rects[rects.length - 1] || dom.getBoundingClientRect()
  }, [editor, session, host])
  const style = useAnchoredPanelPosition(host, ref, { getAnchorRect: anchorRect, alignment: 'end', close: dismiss })
  return <$Panel ref={ref} style={style} className="wysimark-media-paste-menu" role="menu"
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) dismiss() }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); ReactEditor.focus(editor) }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); event.stopPropagation()
          const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
          const index = buttons.indexOf(ref.current?.ownerDocument.activeElement as HTMLButtonElement)
          buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
        }
      }}>
      {isWebSession(session) ? <div className="wysimark-media-import-actions">
        <button type="button" role="menuitemradio" aria-checked={session.choice === 'url'} onClick={() => { void session.choose('url'); dismiss(); ReactEditor.focus(editor) }}><Link /><span>{ui('保留文本链接')}</span></button>
        <button type="button" role="menuitemradio" aria-checked={session.choice === 'title'} onClick={() => { const request = session.choose('title'); dismiss(); ReactEditor.focus(editor); void request.catch(cause => { console.error('Blo Editor: pasted link title failed', cause); new Notice(ui('无法获取网页标题，已保留原链接。')) }) }}><PageTitleIcon /><span>{ui('显示链接标题')}</span></button>
      </div> : <MediaImportActions session={session} close={dismiss} />}
    </$Panel>
}

/** Runs before Slate's automatic URL conversion, after the host's file-transfer handlers. */
export function MediaPasteController({ host }: { host: RefObject<HTMLElement> }) {
  const editor = useSlateStatic(), dialog = useLayer('dialog'), dialogRef = useRef(dialog)
  const pending = useRef<PasteSession | undefined>(undefined)
  const cancelPendingMenu = useRef<(() => void) | undefined>(undefined)
  dialogRef.current = dialog
  useEffect(() => {
    const shell = host.current
    if (!shell) return
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData
      if (event.defaultPrevented || !data || editor.wysimark.readOnly || !editor.selection) return
      if (!(event.target as HTMLElement).closest('[data-slate-editor="true"]') || data.files.length ||
        Array.from(data.items ?? []).some(item => item.kind === 'file')) return
      const media = editor.wysimark.onImageSave && editor.wysimark.downloadAttachment ? clipboardMediaLink(data) : undefined
      const link = media ?? clipboardWebLink(data)
      if (!link || Node.leaf(editor, editor.selection.anchor.path).code || Editor.marks(editor)?.code ||
        Editor.above(editor, { match: node => Element.isElement(node) && node.type === 'code-block' })) return
      event.preventDefault(); event.stopPropagation()
      cancelPendingMenu.current?.()
      pending.current?.dispose()
      dialogRef.current.close()
      const session = media ? createMediaUrlPaste(editor, link.url, link.label, link.fragment) : createWebUrlPaste(editor, link.url, shell.ownerDocument, link.label, link.fragment)
      pending.current = session
      if (!session) return
      const openMenu = () => {
        if (pending.current === session && session.current()) dialogRef.current.open(() => <MediaPasteMenu session={session} host={shell} close={dialogRef.current.close} />)
      }
      if (!isWebSession(session) || editor.wysimark.linkTitlePreferences?.getSnapshot() === false) { openMenu(); return }
      const doc = shell.ownerDocument, win = doc.defaultView!
      let active = true, frame = 0
      const removeListeners = () => {
        doc.removeEventListener('pointerdown', cancel, true)
        doc.removeEventListener('keydown', cancel, true)
        doc.removeEventListener('wheel', cancel, true)
        doc.removeEventListener('touchmove', cancel, true)
        doc.removeEventListener('focusin', onFocus, true)
        win.removeEventListener('blur', cancel)
      }
      const cancel = () => {
        active = false
        removeListeners()
        if (frame) win.cancelAnimationFrame(frame)
        session.dispose()
        if (cancelPendingMenu.current === cancel) cancelPendingMenu.current = undefined
      }
      const onFocus = (event: Event) => { if (!shell.contains(event.target as globalThis.Node)) cancel() }
      cancelPendingMenu.current = cancel
      doc.addEventListener('pointerdown', cancel, true)
      doc.addEventListener('keydown', cancel, true)
      doc.addEventListener('wheel', cancel, { capture: true, passive: true })
      doc.addEventListener('touchmove', cancel, { capture: true, passive: true })
      doc.addEventListener('focusin', onFocus, true)
      win.addEventListener('blur', cancel)
      const showAfterTitle = () => {
        if (!active) return
        // Wait for Slate to commit the new link text before measuring its end.
        frame = win.requestAnimationFrame(() => {
          frame = 0
          removeListeners()
          if (cancelPendingMenu.current === cancel) cancelPendingMenu.current = undefined
          if (active) openMenu()
        })
      }
      void session.choose('title').then(showAfterTitle, cause => {
        console.error('Blo Editor: pasted link title failed', cause)
        showAfterTitle()
      })
    }
    shell.addEventListener('paste', onPaste, true)
    return () => { shell.removeEventListener('paste', onPaste, true); cancelPendingMenu.current?.(); pending.current?.dispose() }
  }, [editor, host])
  return null
}
