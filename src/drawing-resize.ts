/** Suspend the SVG subtree during resizing, without rebuilding its preview. */
export function observeDrawingResize(host: HTMLElement, dragging = false): () => void {
  const win = host.ownerDocument.defaultView!
  let width: number | undefined, timer = 0
  const finish = () => {
    win.clearTimeout(timer); timer = 0
    delete host.dataset.drawingResizing
    host.removeAttribute('aria-busy')
  }
  const mask = () => {
    host.dataset.drawingResizing = 'true'
    host.setAttribute('aria-busy', 'true')
  }
  // A held resize handle owns the gesture, including pauses between moves.
  if (dragging) { mask(); return finish }
  const observer = new win.ResizeObserver(entries => {
    const next = entries[0]?.contentRect.width
    if (!next || next === width) return
    const initial = width === undefined
    width = next
    if (initial) return
    mask()
    win.clearTimeout(timer)
    timer = win.setTimeout(finish, 120)
  })
  observer.observe(host)
  return () => { observer.disconnect(); finish() }
}
