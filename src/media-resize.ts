type Size = { width: number; height: number }
type Options = {
  marker: 'drawingResizing' | 'pdfResizing'
  dragging?: boolean
  initiallyMasked?: boolean
  measure?: () => Size
  onSuspend?: () => void
  onSettled?: (size: Size, current: () => boolean) => void | Promise<void>
}

/** Shared drawing/PDF resize gate: freeze once, coalesce changes, then render. */
export function observeMediaResize(host: HTMLElement, options: Options) {
  const win = host.ownerDocument.defaultView!
  let size: Size | undefined, timer = 0, version = 0, disposed = false
  const finish = () => {
    delete host.dataset[options.marker]
    host.removeAttribute('aria-busy')
  }
  const suspend = () => {
    ++version
    win.clearTimeout(timer); timer = 0
    host.dataset[options.marker] = 'true'
    host.setAttribute('aria-busy', 'true')
    options.onSuspend?.()
  }
  const settle = (next: Size) => {
    const token = version, current = () => !disposed && version === token
    const result = options.onSettled?.(next, current)
    if (result && typeof result.then === 'function') {
      void result.then(() => { if (current()) finish() }).catch(error => { if (current()) finish(); console.error('Blo media resize failed', error) })
    } else if (current()) finish()
  }
  if (options.dragging || options.initiallyMasked) suspend()
  const observer = options.dragging ? undefined : new win.ResizeObserver(entries => {
    const next = options.measure?.() ?? entries[0]?.contentRect
    if (!next?.width || !next.height) return
    const initial = size === undefined
    const changed = !size || next.width !== size.width || !!options.measure && next.height !== size.height
    size = { width: next.width, height: next.height }
    if (!changed || initial && !options.initiallyMasked) return
    suspend()
    timer = win.setTimeout(() => { timer = 0; settle(size!) }, 120)
  })
  observer?.observe(host)
  return {
    suspend,
    dispose() { disposed = true; ++version; observer?.disconnect(); win.clearTimeout(timer); finish() },
  }
}
