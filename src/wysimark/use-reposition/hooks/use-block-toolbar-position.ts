import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { observeAnchoredOverlay } from '../observe-anchored-overlay'
import type { AnchoredOverlayOptions } from '../observe-anchored-overlay'

/** Shared viewport, measurements and listeners for image/table context toolbars. */
export function useBlockToolbarPosition(anchor: HTMLElement | null, ref: RefObject<HTMLElement | null>, options: AnchoredOverlayOptions & { active?: boolean; close?: () => void } = {}) {
  const [position, setPosition] = useState({ left: 0, top: 0, maxWidth: undefined as number | undefined, maxHeight: undefined as number | undefined, visible: false })
  const refresh = useRef<(() => void) | undefined>(undefined)
  const current = useRef(options); current.current = options
  const { active = true, alignment, preferredSide, aboveGap, belowGap, allowResize, maxHeight, getAnchorRect, offsetX, offsetY } = options
  useLayoutEffect(() => {
    const panel = ref.current
    if (!active || !anchor || !panel) return
    const tracker = observeAnchoredOverlay(anchor, panel, next => {
      setPosition(old => old.left === next.left && old.top === next.top && old.maxWidth === next.maxWidth && old.maxHeight === next.maxHeight && old.visible === next.visible ? old : next)
      if (!next.visible) current.current.close?.()
    }, { alignment, preferredSide, aboveGap, belowGap, allowResize, maxHeight, getAnchorRect, offsetX, offsetY })
    refresh.current = tracker.refresh
    tracker.place()
    return () => { tracker.dispose(); if (refresh.current === tracker.refresh) refresh.current = undefined }
  }, [anchor, active, ref, alignment, preferredSide, aboveGap, belowGap, allowResize, maxHeight, getAnchorRect, offsetX, offsetY])
  // Content edits can move an existing anchor without changing its dimensions.
  useLayoutEffect(() => { refresh.current?.() })
  return { ...position, visible: active && !!anchor && position.visible }
}

export function useAnchoredPanelPosition(anchor: HTMLElement, ref: RefObject<HTMLElement | null>, options: AnchoredOverlayOptions & { close?: () => void } = {}) {
  const position = useBlockToolbarPosition(anchor, ref, { allowResize: true, preferredSide: anchor.dataset.overlayPlacement === 'below' ? 'below' : undefined, ...options })
  return { position: 'fixed' as const, left: position.left, top: position.top, maxWidth: position.maxWidth, maxHeight: position.maxHeight, overflowY: 'auto' as const, visibility: position.visible ? 'visible' as const : 'hidden' as const, pointerEvents: position.visible ? 'auto' as const : 'none' as const }
}
