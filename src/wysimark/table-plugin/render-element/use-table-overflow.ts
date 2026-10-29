import { useEffect, useLayoutEffect, useRef } from 'react'
import type { TableElement } from '../types'

/** Layout only: widening a table never changes its saved content or undo history. */
export function useTableOverflow(element: TableElement) {
  const frame = useRef<HTMLDivElement>(null)
  const refresh = useRef<() => void>(() => {})
  useEffect(() => {
    const host = frame.current!, scroll = host.querySelector<HTMLElement>('.blo-table-scroll')!
    const table = scroll.querySelector('table')!, win = host.ownerDocument.defaultView!
    let scheduled = 0, visible = false, lastWidth = 0, lastHeight = 0, lastTableWidth = 0
    const hint = () => {
      host.dataset.moreLeft = String(scroll.scrollLeft > 2)
      host.dataset.moreRight = String(scroll.scrollWidth - scroll.clientWidth - scroll.scrollLeft > 2)
    }
    const measure = () => {
      scheduled = 0
      if (!visible || !host.isConnected || host.clientWidth < 1) return
      const previousScroll = scroll.scrollLeft
      host.dataset.overflow = 'false'
      host.style.removeProperty('--blo-table-width')
      const available = scroll.clientWidth
      const font = parseFloat(win.getComputedStyle(table).fontSize) || 16
      // Row count alone must not make an otherwise comfortable table wider.
      let rowLimit = 9 * font, heightLimit = Math.max(22.5 * font, table.rows.length * 3.25 * font)
      const comfortable = () => table.offsetHeight <= heightLimit && [...table.rows].every(row => row.offsetHeight <= rowLimit)
      if (!comfortable() || table.scrollWidth > available + 1) {
        host.dataset.overflow = 'true'
        let low = available, high = Math.max(available, Math.min(4096, Math.max(available * 4, (table.rows[0]?.cells.length || 1) * 1024)))
        host.style.setProperty('--blo-table-width', `${high}px`)
        // Find a compact width that reduces wrapping, without unbounded expansion
        // for explicit newlines, large media, or intrinsically tall cell content.
        heightLimit = Math.max(heightLimit, table.offsetHeight)
        rowLimit = Math.max(rowLimit, ...[...table.rows].map(row => row.offsetHeight))
        for (let step = 0; step < 7 && high - low > 8; step++) {
          const middle = (low + high) / 2
          host.style.setProperty('--blo-table-width', `${middle}px`)
          if (comfortable()) high = middle; else low = middle
        }
        host.style.setProperty('--blo-table-width', `${Math.ceil(high)}px`)
        // Extra width may not help content with explicit line breaks or tall media.
        // Keep overflow only when it actually improves wrapping or is intrinsic.
        const wideHeight = table.offsetHeight
        host.style.setProperty('--blo-table-width', `${available}px`)
        if (table.offsetHeight > wideHeight + 2 || table.scrollWidth > available + 1) {
          host.style.setProperty('--blo-table-width', `${Math.ceil(high)}px`)
        } else {
          host.dataset.overflow = 'false'
          host.style.removeProperty('--blo-table-width')
        }
      }
      scroll.scrollLeft = previousScroll
      lastWidth = host.clientWidth; lastHeight = table.offsetHeight; lastTableWidth = table.offsetWidth
      hint()
    }
    const schedule = () => {
      if (visible && !scheduled) scheduled = win.requestAnimationFrame(measure)
    }
    refresh.current = schedule
    const resize = new win.ResizeObserver(() => {
      if (host.clientWidth !== lastWidth || table.offsetHeight !== lastHeight || table.offsetWidth !== lastTableWidth) schedule()
    })
    resize.observe(host); resize.observe(table)
    const intersection = new win.IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      if (visible) schedule()
    }, { root: host.closest('.wysimark-editor-container'), rootMargin: '200px' })
    intersection.observe(host)
    scroll.addEventListener('scroll', hint, { passive: true })
    return () => {
      refresh.current = () => {}; win.cancelAnimationFrame(scheduled)
      resize.disconnect(); intersection.disconnect(); scroll.removeEventListener('scroll', hint)
    }
  }, [])
  useLayoutEffect(() => { refresh.current() }, [element])
  return frame
}
