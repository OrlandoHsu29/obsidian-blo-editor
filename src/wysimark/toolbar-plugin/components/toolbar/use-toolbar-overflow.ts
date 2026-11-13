import { useLayoutEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { MenuItemData } from '../../../shared-overlays/types'
import { toolbarWidthMotion } from './use-toolbar-motion'
import { fitToolbar, toolbarIndices } from './fit-toolbar'

/** Measure controls only on layout changes, including theme/font/zoom changes. */
export function useToolbarOverflow(toolbar: RefObject<HTMLDivElement | null>, items: MenuItemData[], enabled: boolean, closeMenus: () => void, maxVisible = items.length, collapseOrder?: readonly number[]) {
  const limit = Math.min(maxVisible, items.length)
  const [indices, setIndices] = useState(() => toolbarIndices(items, index => index < limit))
  useLayoutEffect(() => {
    const host = toolbar.current, parent = host?.parentElement
    if (!host || !parent || !enabled) return
    const win = host.ownerDocument.defaultView!
    const controls = [...host.querySelectorAll<HTMLElement>('[data-toolbar-index]')]
    const more = host.querySelector<HTMLElement>('[data-toolbar-overflow-trigger]')!
    let lastKey: string | undefined, widths: number[] | undefined, moreWidth = 0
    const observedWidths = new WeakMap<Element, number>()
    const measure = () => {
      const style = win.getComputedStyle(host), parentStyle = win.getComputedStyle(parent)
      const px = (value: string) => parseFloat(value) || 0
      const available = parent.clientWidth - px(parentStyle.paddingLeft) - px(parentStyle.paddingRight)
        - px(style.marginLeft) - px(style.marginRight) - px(style.paddingLeft) - px(style.paddingRight)
        - px(style.borderLeftWidth) - px(style.borderRightWidth)
      if (available <= 0) return
      // These controls never flex. A viewport drag changes their budget, not
      // every icon's width; font/theme changes invalidate through the observer.
      if (!widths) {
        const cssWidth = px(style.width) + (style.boxSizing === 'border-box' ? 0 :
          px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth))
        const scale = cssWidth > 0 ? host.getBoundingClientRect().width / cssWidth : 1
        // The budget is in layout pixels; client rects also include window zoom.
        widths = controls.map(control => control.getBoundingClientRect().width / (scale || 1))
        moreWidth = more.getBoundingClientRect().width / (scale || 1)
      }
      const next = fitToolbar(items, widths, available, moreWidth, limit, collapseOrder)
      const key = next.join(',')
      if (key !== lastKey) {
        if (lastKey !== undefined) closeMenus()
        lastKey = key
        setIndices(next)
      }
    }
    const observer = new win.ResizeObserver(entries => {
      let changed = false
      for (const entry of entries) {
        if (entry.target === host && toolbarWidthMotion.has(host)) continue
        const width = entry.contentRect.width
        if (observedWidths.get(entry.target) === width) continue
        observedWidths.set(entry.target, width); changed = true
        if (entry.target !== host && entry.target !== parent) widths = undefined
      }
      // Image/table height changes do not change the toolbar's width budget.
      // ResizeObserver already batches layout changes before paint. Deferring
      // this to another frame makes popout toolbars visibly trail the window.
      if (changed) measure()
    })
    observer.observe(parent); observer.observe(host); observer.observe(more)
    controls.forEach(control => observer.observe(control))
    measure()
    return () => { observer.disconnect() }
  }, [toolbar, items, enabled, limit, collapseOrder])
  return useMemo(() => new Set(indices.filter(index => index < limit)), [indices, limit])
}
