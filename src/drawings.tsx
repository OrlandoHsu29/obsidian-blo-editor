import { App, Component, MarkdownRenderer, Notice, TFile } from 'obsidian'
import { useEffect, useRef, useState } from 'react'
import { Editor, Element, Node, Path, Range, Transforms } from 'slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor, useElement, useReadOnly, useSelected, useSlateStatic } from 'slate-react'
import { blockDepth, groupEnd } from './blocks/model'
import { selectBlockContents } from './blocks/selection'
import { ImageResizeControl } from './wysimark/image-plugin/render-element/image-with-controls/image-resize-controls/image-resize-control'
import type { ImageBlockElement, ImageInlineElement, ImageSize } from './wysimark/image-plugin/types'
import { splitWikiSpec, wikiEmbedUrl } from './wysimark/convert/obsidian-links'
import { ui } from './wysimark/utils/translations'
import { openEmbeddedDrawing } from './drawing-navigation'

const PLUGIN_ID = 'obsidian-excalidraw-plugin'
type DrawingPlugin = {
  getBlankDrawing: () => Promise<string>
  isExcalidrawFile?: (file: TFile) => boolean
  settings?: { compatibilityMode?: boolean }
}
function drawingPlugin(app: App): DrawingPlugin | undefined {
  return (app as App & { plugins?: { plugins: Record<string, DrawingPlugin> } }).plugins?.plugins[PLUGIN_ID]
}
export function isDrawingFile(app: App, file: TFile): boolean {
  return /\.excalidraw(?:\.md)?$/i.test(file.path) ||
    app.metadataCache.getFileCache(file)?.frontmatter?.['excalidraw-plugin'] !== undefined ||
    !!drawingPlugin(app)?.isExcalidrawFile?.(file)
}
/** Drawing data must never pass through Blo's Markdown parser or autosave. */
export function drawingViewType(app: App): 'excalidraw' | 'markdown' {
  return drawingPlugin(app) ? 'excalidraw' : 'markdown'
}
export async function openDrawing(app: App, file: TFile, origin?: { sourcePath: string; editor: Editor }): Promise<void> {
  if (!drawingPlugin(app)) { new Notice(ui('请先安装并启用 Excalidraw')); return }
  if (origin) {
    const source = app.vault.getAbstractFileByPath(origin.sourcePath)
    const leaf = app.workspace.getLeavesOfType('blo-view').find(leaf =>
      (leaf.view as typeof leaf.view & { editor?: Editor }).editor === origin.editor)
    if (source instanceof TFile && leaf && await openEmbeddedDrawing(app, file, leaf, source)) return
  }
  const existing = app.workspace.getLeavesOfType('excalidraw').find(leaf =>
    (leaf.view as typeof leaf.view & { file?: TFile }).file === file)
  const leaf = existing || app.workspace.getLeaf('tab')
  if (!existing) await leaf.setViewState({ type: 'excalidraw', state: { file: file.path }, active: true })
  await app.workspace.revealLeaf(leaf)
  app.workspace.setActiveLeaf(leaf, { focus: true })
}

const creating = new WeakSet<Editor>()
/** Keep the scene as an ordinary attachment and only embed its wiki reference. */
export async function insertDrawing(app: App, source: TFile, editor: Editor, current: () => boolean): Promise<void> {
  if (editor.wysimark.readOnly || creating.has(editor)) return
  const plugin = drawingPlugin(app)
  if (!plugin?.getBlankDrawing) { new Notice(ui('请先安装并启用 Excalidraw')); return }
  creating.add(editor)
  const saved = editor.selection ? Editor.rangeRef(editor, editor.selection, { affinity: 'forward' }) : null
  let drawing: TFile | undefined
  try {
    const content = await plugin.getBlankDrawing()
    if (!current() || editor.wysimark.readOnly) return
    const extension = plugin.settings?.compatibilityMode ? '.excalidraw' : '.excalidraw.md'
    const path = await app.fileManager.getAvailablePathForAttachment(`${source.basename} - ${ui('画板')}${extension}`, source.path)
    if (!current() || editor.wysimark.readOnly) return
    drawing = await app.vault.create(path, content)
    if (!current() || editor.wysimark.readOnly) { new Notice(ui('画板已创建：{path}', { path })); return }
    if (saved && !saved.current) { new Notice(ui('画板已创建：{path}', { path })); return }
    const link = app.metadataCache.fileToLinktext(drawing, source.path, false)
    const insert = () => Editor.withoutNormalizing(editor, () => {
      if (saved?.current) Transforms.select(editor, saved.current)
      else Transforms.select(editor, Editor.end(editor, []))
      const index = editor.selection!.anchor.path[0], root = editor.children[index]
      const depth = blockDepth(root)
      const block = { type: 'image-block' as const, url: wikiEmbedUrl(link), alt: '',
        ...(depth ? { __blockDepth: depth } : {}), children: [{ text: '' }] }
      if (Range.isCollapsed(editor.selection!) && Element.isElement(root) && !editor.isVoid(root) && Node.string(root) === '') {
        Transforms.removeNodes(editor, { at: [index] })
        Transforms.insertNodes(editor, block, { at: [index], select: true })
      } else Transforms.insertNodes(editor, block, { at: [groupEnd(editor.children, index)], select: true })
      const after = Path.next([editor.selection!.anchor.path[0]])
      if (!Node.has(editor, after)) Transforms.insertNodes(editor, {
        type: 'paragraph', ...(depth ? { __blockDepth: depth } : {}), children: [{ text: '' }],
      }, { at: after })
      Transforms.select(editor, Editor.start(editor, after))
      editor.marks = null
    })
    if (HistoryEditor.isHistoryEditor(editor)) HistoryEditor.withNewBatch(editor, insert)
    else insert()
    await editor.wysimark.save?.()
    if (app.workspace.getActiveFile() === source) await openDrawing(app, drawing, { sourcePath: source.path, editor })
  } catch (error) {
    console.error('Blo Editor: drawing operation failed', error)
    new Notice(drawing ? ui('画板已创建：{path}', { path: drawing.path }) : ui('无法创建画板'))
  } finally { saved?.unref(); creating.delete(editor) }
}

export function DrawingEmbed({ app, file, spec, sourcePath }: {
  app: App; file: TFile; spec: string; sourcePath: string
}) {
  const editor = useSlateStatic()
  const element = useElement() as ImageBlockElement | ImageInlineElement
  const selected = useSelected(), readOnly = useReadOnly()
  const ref = useRef<HTMLDivElement>(null)
  const [revision, setRevision] = useState(0), [failed, setFailed] = useState(false)
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null)
  const [size, setSize] = useState<ImageSize | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  useEffect(() => {
    setSize(element.width && element.height ? { width: element.width, height: element.height } : null)
  }, [element.width, element.height])
  const width = size?.width ?? element.width ?? (naturalSize ? Math.min(640, naturalSize.width) : undefined)
  const displaySize = naturalSize && width ? { width, height: width * naturalSize.height / naturalSize.width } : null
  const available = !!drawingPlugin(app)
  const { target: previewTarget, display } = splitWikiSpec(spec)
  // Layout belongs to Blo; passing saved dimensions to Excalidraw can leave
  // fixed-height wrappers behind while its SVG is resized independently.
  const previewSpec = display && /^\d+(?:x\d+)?$/.test(display) ? previewTarget : spec
  useEffect(() => {
    let timer: number | undefined
    const refresh = (changed: TFile) => {
      if (changed !== file) return
      window.clearTimeout(timer); timer = window.setTimeout(() => setRevision(value => value + 1), 120)
    }
    const modified = app.vault.on('modify', refresh), metadata = app.metadataCache.on('changed', refresh)
    return () => { window.clearTimeout(timer); app.vault.offref(modified); app.metadataCache.offref(metadata) }
  }, [app, file])
  useEffect(() => {
    const el = ref.current
    if (!el || !available) return
    let cancelled = false
    const owner = new Component(); owner.load(); el.empty(); setFailed(false)
    const target = el.createDiv()
    // Excalidraw generates the preview asynchronously. Discover its intrinsic
    // size without writing metadata just because a note was opened.
    const measure = () => {
      const image = target.querySelector('img'), svg = target.querySelector('svg')
      const width = image?.naturalWidth || svg?.viewBox.baseVal.width
      const height = image?.naturalHeight || svg?.viewBox.baseVal.height
      if (width && height && !cancelled) setNaturalSize(previous => previous?.width === width && previous.height === height ? previous : { width, height })
    }
    target.addEventListener('load', measure, true)
    const observer = new MutationObserver(measure)
    observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'viewBox'] })
    void MarkdownRenderer.render(app, `![[${previewSpec}]]`, target, sourcePath, owner).catch(() => {
      if (!cancelled) setFailed(true)
    })
    measure()
    return () => { cancelled = true; observer.disconnect(); target.removeEventListener('load', measure, true); owner.unload(); target.remove() }
  }, [app, available, revision, sourcePath, previewSpec])
  const open = () => { void openDrawing(app, file, { sourcePath, editor }).catch(() => new Notice(ui('无法打开画板'))) }
  return <div className={`blo-drawing${selected && !readOnly ? ' is-selected' : ''}`} data-blo-drawing contentEditable={false}
    style={{ width, aspectRatio: naturalSize ? `${naturalSize.width} / ${naturalSize.height}` : undefined }}>
    {available && <button className="blo-drawing-open" type="button" aria-label={ui('放大绘制')}
      onMouseDown={event => { event.preventDefault(); event.stopPropagation() }} onClick={event => { event.stopPropagation(); open() }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
    </button>}
    {available ? <div className="blo-drawing-preview" style={naturalSize ? { position: 'absolute', inset: 0 } : undefined}
      onMouseDown={event => {
        event.preventDefault(); event.stopPropagation()
        if (readOnly || event.button !== 0) return
        const path = ReactEditor.findPath(editor, element)
        if (path.length === 1) selectBlockContents(editor, path[0])
        else Transforms.select(editor, path)
        ReactEditor.focus(editor)
      }} onClickCapture={event => { event.preventDefault(); event.stopPropagation() }}
      onDoubleClickCapture={event => { event.preventDefault(); event.stopPropagation() }}>
      <div ref={ref} className="blo-drawing-content" />
      {failed && <span>{ui('无法预览画板，请使用右上角按钮打开')}</span>}
    </div> : <div className="blo-drawing-unavailable"><a href={`obsidian://show-plugin?id=${PLUGIN_ID}`}>{ui('安装 Excalidraw')}</a></div>}
    {!readOnly && selected && displaySize && naturalSize && <ImageResizeControl
      element={element} srcSize={naturalSize} size={displaySize} setSize={setSize}
      isDragging={isDragging} setIsDragging={setIsDragging} />}
  </div>
}
