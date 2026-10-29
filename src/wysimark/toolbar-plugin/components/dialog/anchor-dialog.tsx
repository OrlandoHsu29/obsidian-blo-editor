import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Editor, Range, Transforms } from 'slate'
import type { RangeRef } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor, useSlateStatic } from 'slate-react'
import { attachmentPreviewUrl } from '../../../../attachment-preview'
import { fetchLinkTitle } from '../../../../remote-link-title'
import { isWikiEmbedUrl, normalizeWikiLinkInput, wikiLinkDisplayText, wikiLinkHref, wikiEmbedUrl, wikiEmbedSpecFromUrl, wikiLinkTarget } from '../../../convert/obsidian-links'
import { CloseMask } from '../../../shared-overlays/components/CloseMask'
import { useAnchoredPanelPosition } from '../../../use-reposition/hooks/use-block-toolbar-position'
import { t, ui } from '../../../utils/translations'
import { $AnchorDialog } from '../../styles'
import { $DialogHint } from '../../styles/dialog-shared-styles'
import { DraggableHeader } from './DraggableHeader'
import type { Rect } from '../../../use-reposition/types'

type DialogProps = { dest: HTMLElement; close: () => void; getAnchorRect?: () => Rect }
type Source = 'url' | 'vault' | 'computer'
const subscribeNoop = () => () => {}

export function AnchorDialog(props: DialogProps) { return <ReferenceDialog {...props} attachment={false} /> }
export function AttachmentInsertDialog(props: DialogProps) { return <ReferenceDialog {...props} attachment /> }

function ReferenceDialog({ dest, close, attachment, getAnchorRect }: DialogProps & { attachment: boolean }) {
  const editor = useSlateStatic()
  const labelId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const location = useRef<RangeRef | null>(null)
  const active = useRef(true)
  const pending = useRef(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const initialText = useMemo(() => editor.selection && !Range.isCollapsed(editor.selection) ? Editor.string(editor, editor.selection) : '', [editor])
  const [source, setSource] = useState<Source>(attachment ? 'vault' : 'url')
  const [url, setUrl] = useState('')
  const [target, setTarget] = useState('')
  const [text, setText] = useState(initialText)
  const [fallbackAutoTitle, setFallbackAutoTitle] = useState(true)
  const titlePreferences = editor.wysimark.linkTitlePreferences
  const autoTitle = useSyncExternalStore(titlePreferences?.subscribe ?? subscribeNoop, titlePreferences?.getSnapshot ?? (() => fallbackAutoTitle))
  const [description, setDescription] = useState(initialText)
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const vaultPaths = useMemo(() => editor.wysimark.getVaultFilePaths?.() ?? [], [editor])
  const valid = source === 'computer' ? !!selectedFile && !!editor.wysimark.onImageSave : source === 'vault' ? !!target.trim() :
    !!url.trim() && (!attachment || !!editor.wysimark.downloadAttachment && !!editor.wysimark.onImageSave)

  useEffect(() => {
    active.current = true
    location.current = Editor.rangeRef(editor, editor.selection ?? Editor.range(editor, Editor.end(editor, [])), { affinity: 'forward' })
    return () => { active.current = false; location.current?.unref(); location.current = null }
  }, [editor])

  const dismiss = () => { active.current = false; close() }
  const handleDrag = useCallback((x: number, y: number) => setDragOffset(previous => ({ x: previous.x + x, y: previous.y + y })), [])
  const style = useAnchoredPanelPosition(dest, ref, { getAnchorRect, offsetX: dragOffset.x - 12, offsetY: dragOffset.y })

  const changeSource = (value: Source) => { setSource(value); setError('') }
  const changeTarget = (value: string) => {
    const parsed = editor.wysimark.normalizeInternalLink?.(value) ?? normalizeWikiLinkInput(value)
    setTarget(parsed.target)
    if (parsed.display !== undefined) {
      if (attachment) setDescription(parsed.display)
      else setText(parsed.display)
    }
  }
  const withDescription = (preview: string) => {
    if (!description.trim() || !isWikiEmbedUrl(preview)) return preview
    return wikiEmbedUrl(`${wikiLinkTarget(wikiEmbedSpecFromUrl(preview))}|${description.trim()}`)
  }

  const insert = async () => {
    if (!valid || pending.current || editor.wysimark.readOnly) return
    if (!location.current?.current) { setError(ui('原插入位置已失效，请关闭弹窗后重试。')); return }
    pending.current = true
    setError('')
    let href = source === 'vault' ? target.trim() : url.trim()
    let preview: string | undefined
    let label = text.trim()
    try {
      if (attachment && source !== 'vault') {
        setSaving(true)
        const save = editor.wysimark.onImageSave!
        const file = source === 'url' ? await editor.wysimark.downloadAttachment!(url.trim()) : selectedFile!
        // Closing or changing documents during a download must not save into another note's context.
        if (!active.current || editor.wysimark.readOnly || !location.current?.current) return
        href = await save(file, file.name)
        label = file.name
        let path = href
        try { path = decodeURI(href) } catch { /* Keep literal percent signs. */ }
        preview = withDescription(attachmentPreviewUrl(file, href) || wikiEmbedUrl(path))
      } else if (source === 'vault') {
        label ||= wikiLinkDisplayText(href)
        if (attachment) preview = withDescription(editor.wysimark.resolveInternalMedia?.(href) || wikiEmbedUrl(href))
        else {
          const spec = label && label !== wikiLinkDisplayText(href) ? `${href}|${label}` : href
          href = wikiLinkHref(spec)
        }
      } else {
        if (!label && autoTitle) {
          setSaving(true)
          label = await fetchLinkTitle(href, dest.ownerDocument) || ''
        }
        label ||= href
      }
      if (!active.current || editor.wysimark.readOnly) return
      const selection = location.current?.current
      if (!selection) { setError(ui('附件已保存，原插入位置已失效')); return }
      const apply = () => Editor.withoutNormalizing(editor, () => {
        Transforms.select(editor, selection)
        if (attachment) editor.image.insertImageFromUrl(preview!, description.trim() || label, description.trim())
        else {
          if (Range.isExpanded(selection) && Editor.string(editor, selection) !== label) Transforms.delete(editor)
          editor.anchor.insertLink(href, label, { select: true, title: title.trim() || undefined })
        }
      })
      if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, apply)
      else apply()
      ReactEditor.focus(editor)
      dismiss()
    } catch (cause) {
      console.error('Blo Editor: reference insertion failed', cause)
      if (active.current) setError(ui('无法插入链接或附件，请检查地址或文件后重试。'))
    } finally {
      pending.current = false
      if (active.current) setSaving(false)
    }
  }

  const sources: Source[] = attachment ? ['vault', 'url', 'computer'] : ['url', 'vault']
  const footerHint = attachment
    ? ui(source === 'vault' ? '直接引用库内文件' : '保存到附件目录并预览')
    : ''
  return <>
    <CloseMask close={dismiss} />
    <$AnchorDialog ref={ref} style={style} className="wysimark-reference-dialog" data-reference-kind={attachment ? 'attachment' : 'link'} role="dialog" aria-labelledby={labelId}>
      <span id={labelId} hidden>{attachment ? ui('附件') : ui('链接')}</span>
      <DraggableHeader onDrag={handleDrag} />
      <form onSubmit={event => { event.preventDefault(); void insert() }}>
        <fieldset disabled={saving}>
          <span id={labelId + '-sources'} hidden>{ui('插入来源')}</span>
          <div className="wysimark-menu-tabs" role="group" aria-labelledby={labelId + '-sources'}>
            {sources.map(value => <button key={value} type="button" aria-pressed={source === value} onClick={() => changeSource(value)}
              disabled={value === 'computer' && !editor.wysimark.onImageSave || attachment && value === 'url' && (!editor.wysimark.onImageSave || !editor.wysimark.downloadAttachment)}>
              {value === 'vault' ? t('linkTypeInternal') : value === 'computer' ? ui('电脑导入') : attachment ? ui('网址导入') : ui('网址')}
            </button>)}
          </div>
          {source === 'computer' ? <>
            <input ref={fileInput} type="file" hidden onChange={event => { const file = event.target.files?.[0]; if (file) { setSelectedFile(file); setError('') } }} />
            <button type="button" className="wysimark-reference-file" onClick={() => fileInput.current?.click()}>{selectedFile?.name ?? t('selectFile')}</button>
          </> : <label className="wysimark-reference-field">
            <span>{source === 'vault' ? ui(attachment ? '笔记库文件' : '本地库文件地址') : t('linkUrl')}</span>
            <input type="text" autoFocus value={source === 'vault' ? target : url} list={source === 'vault' ? labelId + '-files' : undefined}
              placeholder={source === 'vault' ? ui('搜索笔记库文件，或输入路径') : undefined}
              onChange={event => source === 'vault' ? changeTarget(event.target.value) : setUrl(event.target.value)} />
          </label>}
          {source === 'vault' && <datalist id={labelId + '-files'}>{vaultPaths.map(path => <option key={path} value={path} />)}</datalist>}
          {attachment ? <>
            <label className="wysimark-reference-field">
              <span>{ui('内容描述（可选）')}</span>
              <input type="text" value={description} onChange={event => setDescription(event.target.value)} />
            </label>
          </> : <>
            <label className="wysimark-reference-field">
              <span>{ui('显示文字（可选）')}</span>
              <input type="text" value={text} onChange={event => setText(event.target.value)} />
            </label>
            <label className="wysimark-reference-field">
              <span>{ui('悬停提示（可选）')}</span>
              <input type="text" value={title} onChange={event => setTitle(event.target.value)} />
            </label>
          </>}
        </fieldset>
        {error && <div role="alert" className="wysimark-reference-error">{error}</div>}
        <div className="wysimark-reference-actions">
          {footerHint && <$DialogHint className="wysimark-reference-footer-hint" title={footerHint}>{footerHint}</$DialogHint>}
          {!attachment && source === 'url' && <label className="wysimark-reference-auto-title"><input type="checkbox" checked={autoTitle} disabled={saving} onChange={event => {
            if (editor.wysimark.setAutoLinkTitle) editor.wysimark.setAutoLinkTitle(event.target.checked)
            else setFallbackAutoTitle(event.target.checked)
          }} /><span>{ui('插入链接时自动获取链接标题')}</span></label>}
          <button type="submit" disabled={!valid || saving}>{saving ? t('saving') : t('insert')}</button>
        </div>
      </form>
    </$AnchorDialog>
  </>
}
