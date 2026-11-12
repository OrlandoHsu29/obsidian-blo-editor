import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { MenuItemData } from '../../../shared-overlays/types'

/** Measure controls only on layout changes, including theme/font/zoom changes. */
export function useToolbarOverflow(toolbar: RefObject<HTMLDivElement | null>, items: MenuItemData[], enabled: boolean, closeMenus: () => void) {
  const [count, setCount] = useState(items.length)
  useLayoutEffect(() => {
    const host = toolbar.current, parent = host?.parentElement
    if (!host || !parent || !enabled) return
    const win = host.ownerDocument.defaultView!
    const controls = [...host.querySelectorAll<HTMLElement>('[data-toolbar-index]')]
    const more = host.querySelector<HTMLElement>('[data-toolbar-overflow-trigger]')!
    let frame = 0, lastCount = -1, widths: number[] | undefined, moreWidth = 0
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
        widths = controls.map(control => control.getBoundingClientRect().width)
        moreWidth = more.getBoundingClientRect().width
      }
      let next = items.length
      if (widths.reduce((sum, width) => sum + width, 0) > available + .5) {
        const budget = Math.max(0, available - moreWidth)
        let used = 0
        next = 0
        while (next < items.length && used + widths[next] <= budget + .5) used += widths[next++]
        while (next > 0 && items[next - 1] === 'divider') next--
      }
      if (next !== lastCount) {
        if (lastCount !== -1) closeMenus()
        lastCount = next
        setCount(next)
      }
    }
    const schedule = () => {
      if (!frame) frame = win.requestAnimationFrame(() => { frame = 0; measure() })
    }
    const observer = new win.ResizeObserver(entries => {
      let changed = false
      for (const entry of entries) {
        const width = entry.contentRect.width
        if (observedWidths.get(entry.target) === width) continue
        observedWidths.set(entry.target, width); changed = true
        if (entry.target !== host && entry.target !== parent) widths = undefined
      }
      // Image/table height changes do not change the toolbar's width budget.
      if (changed) schedule()
    })
    observer.observe(parent); observer.observe(host); observer.observe(more)
    controls.forEach(control => observer.observe(control))
    measure()
    return () => { observer.disconnect(); if (frame) win.cancelAnimationFrame(frame) }
  }, [toolbar, items, enabled])
  return Math.min(count, items.length)
}
