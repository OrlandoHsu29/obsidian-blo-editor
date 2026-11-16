import { App, MarkdownRenderer, TFile } from 'obsidian'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Transforms } from 'slate'
import { ReactEditor, useElement, useReadOnly, useSelected, useSlateStatic } from 'slate-react'
import { ImageBlockElement, ImageInlineElement, ImageSize } from './wysimark/image-plugin/types'
import { ImageResizeControl } from './wysimark/image-plugin/render-element/image-with-controls/image-resize-controls/image-resize-control'
import { clearBlockSelection } from './blocks/selection'
import { selectStructuredBoundary } from './blocks/boundary'
import { splitWikiSpec } from './wysimark/convert/obsidian-links'
import { useLayer } from './wysimark/use-layer'
import { PdfRenderOwner } from './pdf-render-owner'
import { PdfScrollbar } from './PdfScrollbar'
import { observeMediaResize } from './media-resize'
import { observePdfToolbarOverflow } from './pdf-toolbar-overflow'
import { openOutsidePresentation } from './presentation/navigation'

/** A bounded viewport keeps the native PDF toolbar independent of page size. */
export function PdfEmbed({ app, file, spec, sourcePath }: { app: App; file: TFile; spec: string; sourcePath: string }) {
  const editor = useSlateStatic(), element = useElement() as ImageBlockElement | ImageInlineElement
  const readOnly = useReadOnly(), selected = useSelected(), dialog = useLayer('dialog')
  const content = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  // A moved block can mount in a different Slate chunk. Its very first paint
  // must already be masked, before Obsidian creates any native PDF controls.
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const ownerRef = useRef<PdfRenderOwner | null>(null)
  const [pageRatio, setPageRatio] = useState(297 / 210)
  const toolbarHeight = 44
  const [size, setSize] = useState<ImageSize | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef(false)
  const viewport = useRef<ImageSize | null>(null)
  const resizeControl = useRef<ReturnType<typeof observeMediaResize> | null>(null)
  dragging.current = isDragging
  useLayoutEffect(() => {
    const host = frame.current, toolbar = content.current?.querySelector<HTMLElement>('.pdf-embed > .pdf-toolbar')
    if (ready && host && toolbar) return observePdfToolbarOverflow(host, toolbar)
  }, [ready])
  useLayoutEffect(() => {
    const host = frame.current
    if (!host || !ready) return
    const measure = () => ({ width: host.clientWidth, height: host.clientHeight })
    viewport.current ??= measure()
    const control = observeMediaResize(host, {
      marker: 'pdfResizing', dragging: isDragging, initiallyMasked: true, measure,
      onSuspend: () => {
        ownerRef.current?.suspend()
        if (!host.dataset.pdfFrozen) {
          const size = viewport.current!
          host.style.setProperty('--blo-pdf-viewport-width', `${size.width}px`)
          host.style.setProperty('--blo-pdf-viewport-height', `${size.height}px`)
          host.dataset.pdfFrozen = 'true'
        }
      },
      onSettled: (size, current) => new Promise<void>(resolve => {
        host.removeAttribute('data-pdf-frozen')
        const owner = ownerRef.current
        if (!owner) { resolve(); return }
        owner.fit(setPageRatio, () => {
          if (current()) { viewport.current = size; setLoading(false) }
          resolve()
        })
      }),
    })
    resizeControl.current = control
    return () => { resizeControl.current = null; control.dispose(); host.removeAttribute('data-pdf-frozen') }
  }, [isDragging, ready])
  useEffect(() => { setSize(element.width && element.height ? { width: element.width, height: element.height } : null) }, [element.width, element.height])
  const width = size?.width ?? element.width ?? 640
  // Equal 8px gutters and the viewport border are fixed-size UI, like the
  // toolbar. Only the page itself should grow in proportion to its width.
  const heightOffset = toolbarHeight + 18 * (1 - pageRatio)
  const display = { width, height: width * pageRatio + heightOffset }
  // PDF pages have no useful maximum pixel width; reuse the image drag control
  // with a large source and let the editor width constrain the actual viewport.
  const source = { width: 10000, height: 10000 * pageRatio }
  const parts = splitWikiSpec(spec)
  const previewSpec = parts.display && /^\d+(?:x\d+)?$/.test(parts.display) ? parts.target : spec
  useLayoutEffect(() => {
    const target = content.current
    if (!target) return
    const host = frame.current!
    host.dataset.pdfResizing = 'true'
    host.removeAttribute('data-pdf-frozen')
    setLoading(true); setReady(false)
    const owner = new PdfRenderOwner(); owner.load(); ownerRef.current = owner
    owner.onUserZoom = setZoomed
    let cancelled = false
    void MarkdownRenderer.render(app, `![[${previewSpec}]]`, target, sourcePath, owner).then(() => {
      if (cancelled) target.empty()
      else { setReady(true); setScrollContainer(target.querySelector<HTMLElement>('.pdf-viewer-container')) }
    })
    return () => { cancelled = true; ownerRef.current = null; owner.unload(); target.empty() }
  }, [app, file, previewSpec, sourcePath])
  return <div ref={frame} className={`blo-pdf${selected && !readOnly ? ' is-selected' : ''}`} data-blo-pdf data-pdf-file={file.path} data-pdf-zoomed={zoomed || undefined} data-pdf-resizing={loading || isDragging || undefined} contentEditable={false}
    style={{ width: display.width, aspectRatio: `1 / ${pageRatio}`, paddingTop: heightOffset, boxSizing: 'content-box' }}
    onMouseDownCapture={event => {
      // Keep native controls and scrollbar gestures separate from the note's
      // right-side insertion caret and explicit block selection.
      if (readOnly || event.button !== 0 || (event.target as HTMLElement).closest('.pdf-toolbar,input,button,[data-wysimark-image-resize],[data-blo-pdf-scrollbar]')) return
      const path = ReactEditor.findPath(editor, element)
      event.preventDefault(); event.stopPropagation()
      clearBlockSelection(editor)
      if (path.length === 1) selectStructuredBoundary(editor, path[0])
      else Transforms.select(editor, path)
      ReactEditor.focus(editor)
    }}
    onDoubleClickCapture={event => {
      if ((event.target as HTMLElement).closest('.pdf-toolbar,input,button,[data-wysimark-image-resize]')) return
      event.preventDefault(); event.stopPropagation(); dialog.close()
      void openOutsidePresentation(event.currentTarget.ownerDocument, () => app.workspace.getLeaf('tab').openFile(file))
        .catch(error => console.error('Blo Editor: could not open PDF', error))
    }}>
    <div ref={content} className="blo-pdf-content" />
    <div className="blo-pdf-resize-mask" aria-hidden="true" />
    <PdfScrollbar container={scrollContainer} selected={selected && !readOnly} />
    {!readOnly && selected && <ImageResizeControl element={element} srcSize={source} size={display}
      setSize={setSize} isDragging={isDragging} setIsDragging={value => {
        const next = typeof value === 'function' ? value(dragging.current) : value
        dragging.current = next
        // Hide the native page synchronously, before the first pointer move.
        if (next) resizeControl.current?.suspend()
        setIsDragging(next)
      }} heightOffset={heightOffset} />}
  </div>
}
