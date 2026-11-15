import { useEffect, useRef, useState } from 'react'
import { usePointerDrag } from './wysimark/utils/use-pointer-drag'

/** An overlay track leaves all of the PDF viewport available to the page. */
export function PdfScrollbar({ container, selected }: { container: HTMLElement | null; selected: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState({ top: 0, height: 0, max: 0, value: 0 })
  const [scrolling, setScrolling] = useState(false)
  const [dragging, setDragging] = useState(false)
  const start = useRef({ y: 0, scroll: 0 })
  useEffect(() => {
    if (!container) return
    const win = container.ownerDocument.defaultView!
    let frame = 0, timer = 0
    const measure = () => {
      frame = 0
      const height = track.current?.clientHeight ?? 0, max = Math.max(0, container.scrollHeight - container.clientHeight)
      const thumb = Math.min(height, Math.max(24, height * container.clientHeight / container.scrollHeight))
      const value = Math.max(0, Math.min(max, container.scrollTop))
      setMetrics(previous => {
        const next = { top: max ? value / max * (height - thumb) : 0, height: thumb, max, value }
        return Object.keys(next).every(key => next[key as keyof typeof next] === previous[key as keyof typeof next]) ? previous : next
      })
    }
    const schedule = () => { if (!frame) frame = win.requestAnimationFrame(measure) }
    const scroll = () => { schedule(); setScrolling(true); win.clearTimeout(timer); timer = win.setTimeout(() => setScrolling(false), 800) }
    const observer = new win.ResizeObserver(schedule)
    observer.observe(container)
    const pages = container.querySelector('.pdfViewer')
    if (pages) observer.observe(pages)
    container.addEventListener('scroll', scroll, { passive: true }); schedule()
    return () => { observer.disconnect(); container.removeEventListener('scroll', scroll); win.cancelAnimationFrame(frame); win.clearTimeout(timer) }
  }, [container])
  const drag = usePointerDrag<HTMLDivElement>({
    onStart: event => {
      if (!container || !metrics.max) return false
      start.current = { y: event.clientY, scroll: container.scrollTop }; setDragging(true)
    },
    onMove: event => {
      if (!container) return
      const travel = (track.current?.clientHeight ?? 0) - metrics.height
      if (travel > 0) container.scrollTop = start.current.scroll + (event.clientY - start.current.y) / travel * metrics.max
    },
    onEnd: () => setDragging(false), onCancel: () => setDragging(false),
  })
  return <div ref={track} className="blo-pdf-scrollbar" data-blo-pdf-scrollbar
    data-visible={metrics.max > 0 && (selected || scrolling || dragging) || undefined}
    onMouseDown={event => { event.preventDefault(); event.stopPropagation() }}>
    <div className="blo-pdf-scrollbar-thumb" role="scrollbar" aria-orientation="vertical" aria-label="PDF"
      aria-valuemin={0} aria-valuemax={Math.round(metrics.max)} aria-valuenow={Math.round(metrics.value)}
      style={{ height: metrics.height, transform: `translateY(${metrics.top}px)` }} {...drag} />
  </div>
}
