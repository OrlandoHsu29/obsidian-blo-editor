import type { Menu } from 'obsidian'
import { observeAnchoredOverlay } from './observe-anchored-overlay'

/** Give Obsidian's DOM menu the same anchor tracking as editor-owned panels. */
export function showAnchoredMenu(menu: Menu, anchor: HTMLElement, options: { gap?: number; onHide?: () => void } = {}) {
  const doc = anchor.ownerDocument, win = doc.defaultView!
  const existing = new Set(doc.querySelectorAll('.menu'))
  menu.setUseNativeMenu(false)
  menu.showAtPosition({ x: anchor.getBoundingClientRect().left, y: 8 }, doc)
  const panel = Array.from(doc.querySelectorAll<HTMLElement>('.menu')).find(node => !existing.has(node))
  if (!panel) { menu.hide(); options.onHide?.(); return menu }
  const close = () => menu.hide()
  const outside = (event: PointerEvent) => { if (!event.composedPath().includes(panel)) close() }
  const tracker = observeAnchoredOverlay(anchor, panel, position => {
    if (!position.visible) { close(); return }
    Object.assign(panel.style, { position: 'fixed', left: `${position.left}px`, top: `${position.top}px`, maxWidth: `${position.maxWidth}px`, maxHeight: `${position.maxHeight}px`, boxSizing: 'border-box', overflowY: 'auto', transition: 'none' })
  }, {
    allowResize: true, aboveGap: options.gap ?? 8, belowGap: options.gap ?? 8,
  })
  doc.addEventListener('pointerdown', outside, true)
  win.addEventListener('blur', close)
  menu.onHide(() => {
    tracker.dispose(); doc.removeEventListener('pointerdown', outside, true); win.removeEventListener('blur', close)
    options.onHide?.()
  })
  tracker.place()
  return menu
}
