import { useLayoutEffect, useRef } from 'react'
import type { TableElement } from '../types'
import { createTableMeasure, fitTableWidth, runTableFit } from './table-fit'
import { VIEWPORT_IDLE_MS } from '../../../viewport-work'

const RESIZE_IDLE_MS = 120

/** Keep Slate's table mounted; only the temporary measurement copy is resized. */
export function useTableOverflow(element: TableElement) {
  const frame = useRef<HTMLDivElement>(null)
  const refresh = useRef<() => void>(() => {})
  const previous = useRef(element)
  useLayoutEffect(() => {
    const host = frame.current!, scroll = host.querySelector<HTMLElement>('.blo-table-scroll')!
    const table = scroll.querySelector('table')!, doc = host.ownerDocument, win = doc.defaultView!
    let near = false, dirty = true, ready = false, disposed = false
    let lastWidth = 0, lastHeight = 0, lastTableWidth = 0, lastFrameHeight = 0, observedWidth = 0
    let timer = 0, settling = 0, cancelFit: (() => void) | undefined
    let scrollUntil = 0, resizeUntil = 0, priority = 0
    let fittedWidth: number | undefined
    let measurement: ReturnType<typeof createTableMeasure> | undefined
    const pending = () => host.dataset.tableLayout === 'pending'
    const resized = () => host.clientWidth !== lastWidth || !pending() && (table.offsetHeight !== lastHeight || table.offsetWidth !== lastTableWidth)
    const hint = () => {
      const left = String(scroll.scrollLeft > 2), right = String(scroll.scrollWidth - scroll.clientWidth - scroll.scrollLeft > 2)
      if (host.dataset.moreLeft !== left) host.dataset.moreLeft = left
      if (host.dataset.moreRight !== right) host.dataset.moreRight = right
    }
    const hoverScrollbar = (event: PointerEvent) => {
      if (pending()) return
      const bounds = scroll.getBoundingClientRect()
      const hovering = String(host.dataset.overflow === 'true' &&
        event.clientY >= bounds.top + scroll.clientTop + scroll.clientHeight &&
        event.clientY < bounds.bottom && event.clientX >= host.getBoundingClientRect().left)
      if (scroll.dataset.scrollbarHover !== hovering) scroll.dataset.scrollbarHover = hovering
    }
    const leaveScrollbar = () => { delete scroll.dataset.scrollbarHover }
    const stopFit = () => { cancelFit?.(); cancelFit = undefined; measurement?.dispose(); measurement = undefined }
    const finish = () => {
      win.clearTimeout(settling); settling = 0
      delete host.dataset.tableLayout; delete host.dataset.tablePlaceholder
      host.style.removeProperty('--blo-table-hold-height')
      host.removeAttribute('aria-busy')
    }
    const mask = () => {
      if (pending()) return
      const height = lastFrameHeight || Math.max(48, table.rows.length * 3.25 * (parseFloat(win.getComputedStyle(host).fontSize) || 16))
      win.clearTimeout(settling); settling = 0
      host.style.setProperty('--blo-table-hold-height', `${height}px`)
      // Keep wrapping stable while the surrounding viewport is being resized.
      if (ready) host.style.setProperty('--blo-table-width', `${lastTableWidth}px`)
      host.dataset.tablePlaceholder = 'true'; host.dataset.tableLayout = 'pending'
      host.setAttribute('aria-busy', 'true')
    }
    const publish = (width: number | undefined) => {
        const horizontal = scroll.scrollLeft
        const height = pending() ? parseFloat(host.style.getPropertyValue('--blo-table-hold-height')) : host.offsetHeight
        host.style.setProperty('--blo-table-hold-height', `${height}px`)
        host.dataset.tableLayout = 'settling'
        // Establish the old height before publishing the final width and height.
        void host.offsetHeight
        host.dataset.overflow = String(width !== undefined)
        if (width === undefined) host.style.removeProperty('--blo-table-width')
        else host.style.setProperty('--blo-table-width', `${width}px`)
        lastFrameHeight = scroll.offsetHeight
        host.style.setProperty('--blo-table-hold-height', `${lastFrameHeight}px`)
        scroll.scrollLeft = horizontal
        lastWidth = observedWidth = host.clientWidth; lastHeight = table.offsetHeight; lastTableWidth = table.offsetWidth
        fittedWidth = width; dirty = false; ready = true; hint()
        if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) finish()
        else settling = win.setTimeout(finish, 180)
    }
    const start = () => {
      timer = 0
      if (disposed || !near || !host.isConnected || host.clientWidth < 1) return
      const idle = Math.max(resizeUntil, scrollUntil + (priority > 0 ? 80 : 0))
      if (win.performance.now() < idle) { schedule(idle - win.performance.now()); return }
      if (!dirty && !resized()) { if (pending()) publish(fittedWidth); return }
      stopFit()
      const width = host.clientWidth
      measurement = createTableMeasure(host, width)
      const iterator = fitTableWidth(measurement.host)
      cancelFit = runTableFit(win, iterator, result => {
        stopFit()
        if (disposed) return
        if (host.clientWidth !== width) { dirty = true; mask(); schedule(120); return }
        publish(result.width)
      }, error => {
        stopFit(); finish(); dirty = true
        console.error('Blo Editor: table layout failed', error)
      }, () => priority, () => Math.max(scrollUntil, resizeUntil))
    }
    const schedule = (delay: number) => {
      win.clearTimeout(timer); timer = 0
      // Event handlers only schedule work. Read geometry once in start(), after
      // the resize/scroll deadline, rather than forcing layout on every event.
      if (!disposed && near) timer = win.setTimeout(start, delay)
    }
    refresh.current = () => { dirty = true; stopFit(); schedule(120) }
    // Reserve a simple box before the first paint; pre-fit before it is on screen.
    mask()
    const resize = new win.ResizeObserver(() => {
      const width = host.clientWidth
      // A skipped ancestor can report zero while the cached table is unchanged.
      if (width <= 0) return
      if (width !== observedWidth) {
        const initial = observedWidth === 0 && !ready
        observedWidth = width
        if (initial) schedule(0)
        else { resizeUntil = win.performance.now() + RESIZE_IDLE_MS; stopFit(); mask(); schedule(RESIZE_IDLE_MS) }
      } else if (ready && !pending()) {
        if (table.offsetWidth !== lastTableWidth) schedule(120)
        else {
          // Image loads can change row heights without invalidating column fit.
          const height = table.offsetHeight, frameHeight = scroll.offsetHeight
          if (height !== lastHeight || frameHeight !== lastFrameHeight) {
            lastHeight = height; lastFrameHeight = frameHeight
            if (settling) {
              host.style.setProperty('--blo-table-hold-height', `${frameHeight}px`)
              win.clearTimeout(settling); settling = win.setTimeout(finish, 180)
            }
          }
        }
      }
    })
    resize.observe(host); resize.observe(table)
    const intersection = new win.IntersectionObserver(entries => {
      const entry = entries[0]
      near = entry.isIntersecting
      if (entry.rootBounds) {
        // rootBounds includes our 1000px prefetch margin; rank against the
        // actual viewport so a jump cannot queue the upper buffer first.
        const top = entry.rootBounds.top + 1000, bottom = entry.rootBounds.bottom - 1000
        priority = Math.max(top - entry.boundingClientRect.bottom, entry.boundingClientRect.top - bottom, 0)
      }
      if (near) schedule(0)
      else { win.clearTimeout(timer); timer = 0; stopFit() }
    }, { root: host.closest('.wysimark-editor-container'), rootMargin: '1000px' })
    intersection.observe(host)
    const windowResized = () => {
      // Also gate viewport re-entry and content/font refreshes while resizing.
      // They must not bypass the observer's trailing debounce.
      resizeUntil = win.performance.now() + RESIZE_IDLE_MS
      stopFit()
      if (near) mask()
      schedule(RESIZE_IDLE_MS)
    }
    const release = () => { if (timer && pending()) { resizeUntil = 0; win.clearTimeout(timer); start() } }
    const scrolling = (event: Event) => {
      const target = event.target as globalThis.Node | null
      if (target !== scroll && !target?.contains?.(host)) return
      scrollUntil = win.performance.now() + VIEWPORT_IDLE_MS
      if (timer && ready && !pending()) { win.clearTimeout(timer); timer = win.setTimeout(start, VIEWPORT_IDLE_MS) }
    }
    scroll.addEventListener('scroll', hint, { passive: true })
    scroll.addEventListener('pointermove', hoverScrollbar, { passive: true })
    scroll.addEventListener('pointerleave', leaveScrollbar)
    doc.addEventListener('pointerup', release, true)
    doc.addEventListener('scroll', scrolling, { capture: true, passive: true })
    win.addEventListener('resize', windowResized)
    doc.fonts?.addEventListener('loadingdone', refresh.current)
    const fontChanged = refresh.current
    return () => {
      disposed = true; refresh.current = () => {}
      win.clearTimeout(timer); win.clearTimeout(settling); stopFit()
      resize.disconnect(); intersection.disconnect(); scroll.removeEventListener('scroll', hint)
      scroll.removeEventListener('pointermove', hoverScrollbar); scroll.removeEventListener('pointerleave', leaveScrollbar)
      doc.removeEventListener('pointerup', release, true); doc.fonts?.removeEventListener('loadingdone', fontChanged)
      doc.removeEventListener('scroll', scrolling, true)
      win.removeEventListener('resize', windowResized)
      finish()
    }
  }, [])
  useLayoutEffect(() => {
    const old = previous.current; previous.current = element
    if (old.children !== element.children || old.columns !== element.columns || old.headerRow !== element.headerRow || old.headerColumn !== element.headerColumn) refresh.current()
  }, [element])
  return frame
}
