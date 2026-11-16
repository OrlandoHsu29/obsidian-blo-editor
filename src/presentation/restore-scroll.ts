/** Keep the original offset while fullscreen reflow settles; yield to user input. */
export function restorePresentationScroll(scroller: HTMLElement, top: number): () => void {
  const win = scroller.ownerDocument.defaultView!, doc = scroller.ownerDocument
  const anchoring = scroller.style.overflowAnchor
  let frame = 0, timer = 0, disposed = false
  scroller.style.overflowAnchor = 'none'
  const dispose = () => {
    if (disposed) return
    disposed = true; observer.disconnect(); win.cancelAnimationFrame(frame); win.clearTimeout(timer); win.clearTimeout(limit)
    scroller.style.overflowAnchor = anchoring
    scroller.removeEventListener('wheel', dispose); scroller.removeEventListener('pointerdown', dispose); doc.removeEventListener('keydown', dispose, true)
  }
  const schedule = () => {
    if (frame || disposed) return
    frame = win.requestAnimationFrame(() => {
      frame = 0
      if (!scroller.isConnected) { dispose(); return }
      scroller.scrollTop = top
      win.clearTimeout(timer)
      timer = win.setTimeout(() => { if (scroller.isConnected) scroller.scrollTop = top; dispose() }, 120)
    })
  }
  const observer = new win.ResizeObserver(schedule), limit = win.setTimeout(dispose, 1000)
  observer.observe(scroller)
  const content = scroller.querySelector<HTMLElement>('[data-slate-editor]'); if (content) observer.observe(content)
  scroller.addEventListener('wheel', dispose, { passive: true }); scroller.addEventListener('pointerdown', dispose); doc.addEventListener('keydown', dispose, true)
  schedule()
  return dispose
}
