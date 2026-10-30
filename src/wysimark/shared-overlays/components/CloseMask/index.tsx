import React, { useEffect, useRef } from "react"

/** Close the sibling panel on outside pointer-down without blocking scrolling. */
export function CloseMask({ close, isInside }: { close: () => void; isInside?: (target: Node) => boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const current = useRef(close); current.current = close
  const inside = useRef(isInside); inside.current = isInside
  useEffect(() => {
    const marker = ref.current, doc = marker?.ownerDocument
    if (!marker || !doc) return
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!marker.parentElement?.contains(target) && !inside.current?.(target)) current.current()
    }
    doc.addEventListener('pointerdown', outside, true)
    return () => doc.removeEventListener('pointerdown', outside, true)
  }, [])
  // A fullscreen mask swallowed wheel events and stopped the editor scrolling.
  return <span ref={ref} hidden aria-hidden="true" />
}
