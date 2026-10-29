import { useEffect, useId, useRef, useState } from 'react'
import { Editor, Node } from 'slate'
import type { PathRef } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { CloseMask } from '../../shared-overlays/components/CloseMask'
import { t, ui } from '../../utils/translations'
import { useLayer } from '../../use-layer'
import { useAnchoredPanelPosition } from '../../use-reposition/hooks/use-block-toolbar-position'
import type { AnchorElement } from '../index'
import { DraggableHeader } from '../../toolbar-plugin/components/dialog/DraggableHeader'
import { $AnchorDialog } from '../../toolbar-plugin/styles/anchor-dialog-styles'
import { isWikiLinkHref, normalizeWikiLinkInput, splitWikiSpec, wikiLinkDisplayText, wikiLinkHref, wikiLinkSpecFromHref } from '../../convert/obsidian-links'

export function AnchorEditDialog({ destAnchor, destStartEdge, element, initialEmbed = false, onCancel }: {
  destAnchor: HTMLElement; destStartEdge: HTMLElement; element: AnchorElement
  initialEmbed?: boolean; onCancel?: () => void
}) {
  const editor = useSlateStatic(), dialog = useLayer('dialog'), id = useId()
  const ref = useRef<HTMLDivElement>(null), location = useRef<PathRef | null>(null)
  const internal = isWikiLinkHref(element.href)
  const parts = splitWikiSpec(internal ? wikiLinkSpecFromHref(element.href) : '')
  const [mode, setMode] = useState(internal ? 'internal' : 'external')
  const [href, setHref] = useState(internal ? '' : element.href)
  const [target, setTarget] = useState(parts.target)
  const [text, setText] = useState(parts.display || Node.string(element))
  const [title, setTitle] = useState(element.title || '')
  const [error, setError] = useState('')
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [vaultPaths] = useState(() => editor.wysimark.getVaultFilePaths?.() ?? [])
  const close = () => { if (onCancel) onCancel(); else dialog.close() }
  const valid = !!(mode === 'internal' ? target : href).trim()

  useEffect(() => {
    location.current = Editor.pathRef(editor, ReactEditor.findPath(editor, element))
    return () => { location.current?.unref(); location.current = null }
  }, [editor, element])
  const style = useAnchoredPanelPosition(destAnchor, ref, { offsetX: dragOffset.x, offsetY: dragOffset.y })
  const submit = () => {
    if (!valid || editor.wysimark.readOnly) return
    const at = location.current?.current
    if (!at) { setError(ui('原插入位置已失效，请关闭弹窗后重试。')); return }
    const label = text.trim()
    const spec = label && label !== wikiLinkDisplayText(target.trim()) ? `${target.trim()}|${label}` : target.trim()
    const apply = () => Editor.withoutNormalizing(editor, () => {
      if (initialEmbed) editor.anchor.convertToEmbed(spec, { at })
      else editor.anchor.editLink({
        href: mode === 'internal' ? wikiLinkHref(spec) : href.trim(),
        text: label || (mode === 'internal' ? wikiLinkDisplayText(target.trim()) : href.trim()),
        title: title.trim() || undefined,
      }, { at })
    })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
    else apply()
    dialog.close()
    ReactEditor.focus(editor)
  }
  return <>
    <CloseMask close={close} />
    <$AnchorDialog ref={ref} contentEditable={false} style={style} className="wysimark-reference-dialog" data-reference-kind={initialEmbed ? 'attachment' : 'link'} role="dialog" aria-labelledby={id + '-label'}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}>
      <span id={id + '-label'} hidden>{initialEmbed ? ui('附件') : ui('链接')}</span>
      <span id={id + '-sources'} hidden>{ui('插入来源')}</span>
      <DraggableHeader onDrag={(x, y) => setDragOffset(previous => ({ x: previous.x + x, y: previous.y + y }))} />
      <form onSubmit={event => { event.preventDefault(); submit() }}>
        <fieldset>
          {!initialEmbed && <div className="wysimark-menu-tabs" role="group" aria-labelledby={id + '-sources'}>
            <button type="button" aria-pressed={mode === 'external'} onClick={() => setMode('external')}>{ui('网址')}</button>
            <button type="button" aria-pressed={mode === 'internal'} onClick={() => setMode('internal')}>{t('linkTypeInternal')}</button>
          </div>}
          <label className="wysimark-reference-field">
            <span>{mode === 'internal' ? ui('本地库文件地址') : t('linkUrl')}</span>
            <input type="text" autoFocus value={mode === 'internal' ? target : href} list={mode === 'internal' ? id : undefined}
              placeholder={mode === 'internal' ? ui('搜索笔记库文件，或输入路径') : undefined}
              onChange={event => {
                if (mode === 'external') { setHref(event.target.value); return }
                const parsed = editor.wysimark.normalizeInternalLink?.(event.target.value) ?? normalizeWikiLinkInput(event.target.value)
                setTarget(parsed.target)
                if (parsed.display !== undefined) setText(parsed.display)
              }} />
          </label>
          {mode === 'internal' && <datalist id={id}>{vaultPaths.map(path => <option key={path} value={path} />)}</datalist>}
          <label className="wysimark-reference-field">
            <span>{ui(initialEmbed ? '内容描述（可选）' : '显示文字（可选）')}</span>
            <input type="text" value={text} onChange={event => setText(event.target.value)} />
          </label>
          {!initialEmbed && <label className="wysimark-reference-field">
            <span>{ui('悬停提示（可选）')}</span>
            <input type="text" value={title} onChange={event => setTitle(event.target.value)} />
          </label>}
        </fieldset>
        {error && <div role="alert" className="wysimark-reference-error">{error}</div>}
        <div className="wysimark-reference-actions">
          <button type="submit" disabled={!valid}>{t('apply')}</button>
        </div>
      </form>
    </$AnchorDialog>
  </>
}
