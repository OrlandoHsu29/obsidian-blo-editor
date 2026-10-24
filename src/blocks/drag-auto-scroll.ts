/** Scroll only this editor's nearest vertical scroller during a block drag. */
export function startBlockDragAutoScroll(editable: HTMLElement, onScroll: (x: number, y: number) => void): () => void {
  const doc = editable.ownerDocument, win = doc.defaultView!
  let scroller: HTMLElement | null = editable
  while (scroller) {
    if (/(auto|scroll|overlay)/.test(win.getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight) break
    scroller = scroller.parentElement
  }
  if (!scroller) return () => {}
  const container = scroller
  // Lazy chunks change their measured height while entering the viewport.
  // Native scroll anchoring must not move the page against the drag direction.
  const overflowAnchor = container.style.overflowAnchor
  const scrollBehavior = container.style.scrollBehavior
  container.style.overflowAnchor = 'none'
  container.style.scrollBehavior = 'auto'
  container.scrollTo({ top: container.scrollTop, behavior: 'auto' })
  let pointer: { x: number; y: number } | null = null, frame = 0, previousTime = 0, disposed = false
  const stop = () => {
    if (frame) win.cancelAnimationFrame(frame)
    frame = 0; previousTime = 0; pointer = null
  }
  const velocity = () => {
    if (!pointer || !editable.isConnected || !container.isConnected) return 0
    const bounds = container.getBoundingClientRect()
    const top = Math.max(0, bounds.top), bottom = Math.min(win.innerHeight, bounds.bottom)
    if (pointer.x < Math.max(0, bounds.left) || pointer.x > Math.min(win.innerWidth, bounds.right) || pointer.y < top || pointer.y > bottom) return 0
    const edge = Math.min(72, (bottom - top) / 4)
    if (edge <= 0) return 0
    // Speed increases toward the edge, independent of native dragover frequency.
    if (pointer.y < top + edge && container.scrollTop > 0) return -900 * (top + edge - pointer.y) / edge
    if (pointer.y > bottom - edge && container.scrollTop < container.scrollHeight - container.clientHeight) return 900 * (pointer.y - bottom + edge) / edge
    return 0
  }
  const tick = (time: number) => {
    frame = 0
    const speed = velocity()
    if (!speed || disposed) { previousTime = 0; return }
    const elapsed = previousTime ? Math.min(48, time - previousTime) : 1000 / 60
    previousTime = time
    const before = container.scrollTop
    container.scrollTop += speed * elapsed / 1000
    if (container.scrollTop === before) { previousTime = 0; return }
    if (pointer) onScroll(pointer.x, pointer.y)
    if (!disposed && pointer) frame = win.requestAnimationFrame(tick)
  }
  const over = (event: DragEvent) => {
    pointer = { x: event.clientX, y: event.clientY }
    if (!velocity()) { stop(); return }
    if (!frame) frame = win.requestAnimationFrame(tick)
  }
  const leave = (event: DragEvent) => {
    if (!event.relatedTarget && (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= win.innerWidth || event.clientY >= win.innerHeight)) stop()
  }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') stop() }
  const visibility = () => { if (doc.hidden) stop() }
  const dispose = () => {
    if (disposed) return
    disposed = true; stop()
    container.style.overflowAnchor = overflowAnchor
    container.style.scrollBehavior = scrollBehavior
    doc.removeEventListener('dragover', over, true)
    doc.removeEventListener('dragleave', leave, true)
    doc.removeEventListener('drop', dispose, true)
    doc.removeEventListener('dragend', dispose, true)
    doc.removeEventListener('keydown', key, true)
    doc.removeEventListener('visibilitychange', visibility)
    win.removeEventListener('blur', stop)
  }
  doc.addEventListener('dragover', over, true)
  doc.addEventListener('dragleave', leave, true)
  doc.addEventListener('drop', dispose, true)
  doc.addEventListener('dragend', dispose, true)
  doc.addEventListener('keydown', key, true)
  doc.addEventListener('visibilitychange', visibility)
  win.addEventListener('blur', stop)
  return dispose
}
