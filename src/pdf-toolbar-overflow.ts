/** The same directional edge hints as tables, without React updates on scroll. */
export function observePdfToolbarOverflow(host: HTMLElement, toolbar: HTMLElement): () => void {
  const win = host.ownerDocument.defaultView!
  let frame = 0
  const update = () => {
    frame = 0
    const left = String(toolbar.scrollLeft > 2)
    const right = String(toolbar.scrollWidth - toolbar.clientWidth - toolbar.scrollLeft > 2)
    if (host.dataset.pdfToolbarMoreLeft !== left) host.dataset.pdfToolbarMoreLeft = left
    if (host.dataset.pdfToolbarMoreRight !== right) host.dataset.pdfToolbarMoreRight = right
  }
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update) }
  const observer = new win.ResizeObserver(schedule)
  observer.observe(toolbar)
  for (const group of Array.from(toolbar.children)) observer.observe(group)
  toolbar.addEventListener('scroll', schedule, { passive: true })
  update()
  return () => {
    observer.disconnect(); toolbar.removeEventListener('scroll', schedule); win.cancelAnimationFrame(frame)
    delete host.dataset.pdfToolbarMoreLeft; delete host.dataset.pdfToolbarMoreRight
  }
}
