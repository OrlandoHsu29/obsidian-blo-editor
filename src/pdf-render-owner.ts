import { Component } from 'obsidian'

type PdfPage = { div?: HTMLElement; renderingState?: number; pdfPage?: { getViewport(options: { scale: number }): { width: number; height: number } } }
type PdfViewer = {
  currentScaleValue: string | number
  currentScale?: number
  container?: HTMLElement
  currentPageNumber: number
  scrollMode: number
  spreadMode: number
  pagesCount?: number
  firstPagePromise?: Promise<unknown>
  getPageView(index: number): PdfPage | undefined
  renderingQueue?: PdfQueue
}
type PdfQueue = { highestPriorityPage: string | null; renderHighestPriority(...args: unknown[]): void }
type RenderEvent = { pageNumber?: number }
type PdfEvents = { _on(name: string, handler: (event: RenderEvent) => void): void; _off(name: string, handler: (event: RenderEvent) => void): void }
type PdfChild = { resizeObserver?: { disconnect(): void }; pdfViewer?: { pdfViewer?: PdfViewer; eventBus?: PdfEvents; pdfRenderingQueue?: PdfQueue } }
type PdfHost = { opts?: { displayMode?: boolean }; then(callback: (child: PdfChild) => void): void }

/** Keep Obsidian's private PDF integration in one guarded adapter. */
export class PdfRenderOwner extends Component {
  private host?: PdfHost
  private alive = false
  private cancelRender?: () => void
  private fitting = false
  private paused = false
  private revision = 0
  private queue?: PdfQueue
  private userZoomed = false
  private ratio = 0
  private onRatio?: (ratio: number) => void
  onUserZoom?: (zoomed: boolean) => void
  override onload() { this.alive = true }
  override onunload() { this.alive = false; ++this.revision; this.cancelRender?.(); this.host = undefined }
  override addChild<T extends Component>(child: T): T {
    const host = (child as T & { viewer?: PdfHost }).viewer
    if (host?.opts && typeof host.then === 'function') {
      // MarkdownRenderer defaults to a static cover and moves the page canvas
      // out of the viewer. Choose interactive mode before the child loads.
      host.opts.displayMode = false
      this.host = host
      host.then(child => {
        const viewer = child.pdfViewer?.pdfViewer, bus = child.pdfViewer?.eventBus
        if (!viewer || !this.alive) return
        // Our shared resize gate now owns geometry updates. Leaving the native
        // debounced observer active would resize the PDF again under the mask.
        child.resizeObserver?.disconnect()
        const queue = child.pdfViewer?.pdfRenderingQueue ?? viewer.renderingQueue
        if (queue) {
          this.queue = queue
          const original = queue.renderHighestPriority, owner = this
          const guarded = function(this: PdfQueue, ...args: unknown[]) {
            if (!owner.paused) original.apply(this, args)
          }
          queue.renderHighestPriority = guarded
          this.register(() => { if (queue.renderHighestPriority === guarded) queue.renderHighestPriority = original })
        }
        if (!bus) return
        const zoom = () => { if (!this.fitting) { this.userZoomed = true; this.onUserZoom?.(true) } }
        const pageChanged = () => {
          if (this.fitting || this.userZoomed || !this.onRatio) return
          const page = viewer.getPageView(Math.max(0, viewer.currentPageNumber - 1))?.pdfPage?.getViewport({ scale: 1 })
          // Mixed portrait/landscape documents must fit the page being viewed,
          // without letting off-screen wide pages create a horizontal track.
          // Scrolling across an orientation change must not resize the note's
          // embed or start its resize mask. Fit the reader in place instead.
          if (page?.width && page.height && Math.abs(page.height / page.width - this.ratio) > .001) this.fit(() => {})
        }
        bus._on('zoomin', zoom); bus._on('zoomout', zoom); bus._on('scalechanged', zoom)
        bus._on('pagechanging', pageChanged)
        this.register(() => { bus._off('zoomin', zoom); bus._off('zoomout', zoom); bus._off('scalechanged', zoom); bus._off('pagechanging', pageChanged) })
      })
    }
    return super.addChild(child)
  }
  suspend() {
    ++this.revision
    if (this.paused) return
    this.paused = true
    this.cancelRender?.()
    // PDF.js cooperatively pauses an in-flight page at its next continuation.
    // The guarded queue cannot start another page while the gesture is active.
    if (this.queue) this.queue.highestPriorityPage = null
  }
  fit(onRatio: (ratio: number) => void, onFit?: () => void) {
    const revision = ++this.revision
    this.onRatio = onRatio
    if (!this.host) { onFit?.(); return }
    this.host?.then(child => {
      const viewer = child.pdfViewer?.pdfViewer
      if (!viewer) { onFit?.(); return }
      void Promise.resolve(viewer.firstPagePromise).then(async () => {
        if (!this.alive || revision !== this.revision) return
        this.paused = false
        this.fitting = true
        this.userZoomed = false
        this.onUserZoom?.(false)
        // Retain native continuous scrolling between pages.
        viewer.scrollMode = 0
        viewer.spreadMode = 0
        const page = viewer.getPageView(Math.max(0, viewer.currentPageNumber - 1))?.pdfPage?.getViewport({ scale: 1 })
        if (page?.width && page.height) { this.ratio = page.height / page.width; onRatio(this.ratio) }
        // Match the page's real CSS width to the viewport, including our equal
        // eight-pixel page gutters. Do not reserve space for a vertical track.
        const div = viewer.getPageView(Math.max(0, viewer.currentPageNumber - 1))?.div
        const container = viewer.container
        if (div?.offsetWidth && div.offsetHeight && container && viewer.currentScale) {
          const factor = (container.clientWidth - 16) / div.offsetWidth
          if (factor > 0 && Math.abs(factor - 1) > .001) viewer.currentScaleValue = viewer.currentScale * factor
        } else viewer.currentScaleValue = 'page-width'
        this.queue?.renderHighestPriority()
        if (onFit) await this.rendered(child, viewer)
      }).catch(error => console.error('Blo PDF layout failed', error)).finally(() => {
        if (revision === this.revision) this.fitting = false
        if (this.alive) onFit?.()
      })
    })
  }
  private rendered(child: PdfChild, viewer: PdfViewer): Promise<void> {
    this.cancelRender?.()
    const bus = child.pdfViewer?.eventBus
    const page = viewer.getPageView(Math.max(0, viewer.currentPageNumber - 1))
    if (!bus || page?.renderingState === 3) return Promise.resolve()
    return new Promise(resolve => {
      const win = viewer.container?.ownerDocument.defaultView
      let timer: number | undefined
      const finish = () => {
        bus._off('pagerendered', rendered)
        if (timer !== undefined) win?.clearTimeout(timer)
        if (this.cancelRender === finish) this.cancelRender = undefined
        resolve()
      }
      const rendered = (event: RenderEvent) => { if (event.pageNumber === viewer.currentPageNumber) finish() }
      bus._on('pagerendered', rendered)
      this.cancelRender = finish
      // A failed/native-cancelled render must not leave an opaque mask forever.
      if (win) timer = win.setTimeout(finish, 3000)
    })
  }
}
