export type PresentationScroll = { top: number; anchor?: HTMLElement; ratio?: number; offset?: number }

/** Remember a point in visible content, not an offset invalidated by reflow. */
export function capturePresentationScroll(scroller: HTMLElement): PresentationScroll {
  const doc = scroller.ownerDocument, box = scroller.getBoundingClientRect()
  const toolbar = scroller.querySelector<HTMLElement>('[data-wysimark-toolbar]')?.getBoundingClientRect()
  const y = Math.min(box.bottom - 4, Math.max(box.top, toolbar?.bottom ?? box.top) + 12)
  for (const fraction of [.5, .25, .75]) {
    const anchor = doc.elementFromPoint(box.left + box.width * fraction, y)?.closest<HTMLElement>('[data-wysimark-block]')
    if (!anchor || !scroller.contains(anchor)) continue
    const bounds = anchor.getBoundingClientRect()
    if (bounds.height) return { top: scroller.scrollTop, anchor, ratio: Math.max(0, Math.min(1, (y - bounds.top) / bounds.height)), offset: y - box.top }
  }
  return { top: scroller.scrollTop }
}

/** Preserve visible content while fullscreen reflow settles; yield to user input. */
export function restorePresentationScroll(scroller: HTMLElement, position: number | PresentationScroll): () => void {
  const win = scroller.ownerDocument.defaultView!, doc = scroller.ownerDocument
  const saved = typeof position === 'number' ? { top: position } : position
  const apply = () => {
    if (saved.anchor?.isConnected && scroller.contains(saved.anchor)) {
      const bounds = saved.anchor.getBoundingClientRect(), box = scroller.getBoundingClientRect()
      const toolbar = scroller.querySelector<HTMLElement>('[data-wysimark-toolbar]')?.getBoundingClientRect()
      const offset = Math.max(saved.offset ?? 0, toolbar ? toolbar.bottom - box.top + 12 : 0)
      const scale = scroller.offsetHeight ? box.height / scroller.offsetHeight : 1
      scroller.scrollTop += (bounds.top + bounds.height * (saved.ratio ?? 0) - box.top - offset) / (scale || 1)
    } else scroller.scrollTop = saved.top
  }
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
      apply()
      win.clearTimeout(timer)
      timer = win.setTimeout(() => { if (scroller.isConnected) apply(); dispose() }, 120)
    })
  }
  const observer = new win.ResizeObserver(schedule), limit = win.setTimeout(dispose, 1000)
  observer.observe(scroller)
  const content = scroller.querySelector<HTMLElement>('[data-slate-editor]'); if (content) observer.observe(content)
  scroller.addEventListener('wheel', dispose, { passive: true }); scroller.addEventListener('pointerdown', dispose); doc.addEventListener('keydown', dispose, true)
  schedule()
  return dispose
}
