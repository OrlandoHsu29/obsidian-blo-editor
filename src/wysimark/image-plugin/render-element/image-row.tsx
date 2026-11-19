import { useCallback, useLayoutEffect, useRef } from 'react'
import { rowImages } from '../row-model'
import type { ConstrainedRenderElementProps } from '../../sink'
import type { ImageRowElement } from '../types'

export function ImageRow({element, attributes, children}: ConstrainedRenderElementProps<ImageRowElement>) {
  const track = useRef<HTMLDivElement>(null)
  const update = useCallback(() => {
    const root = track.current
    if (!root || !root.clientWidth) return
    const images = rowImages(element)
    let index = 0
    let preferredWidth = 0
    for (const child of Array.from(root.children) as HTMLElement[]) {
      if (child.hasAttribute('data-blo-image-gap')) {
        preferredWidth += child.offsetWidth
        continue
      }
      if (!child.hasAttribute('data-blo-image-item')) continue
      const image = images[index++]
      const img = child.querySelector<HTMLImageElement>('[data-blo-image] > img')
      const width = img?.naturalWidth || image?.srcWidth || image?.width
      const height = img?.naturalHeight || image?.srcHeight || image?.height
      const aspect = width && height ? width / height : undefined
      if (aspect) {
        const ratio = String(aspect)
        if (child.style.getPropertyValue('--blo-image-ratio') !== ratio) child.style.setProperty('--blo-image-ratio', ratio)
      }
      preferredWidth += image?.width ?? (image?.height && aspect ? image.height * aspect : width ?? 0)
    }
    root.toggleAttribute('data-blo-image-row-fit', preferredWidth > root.clientWidth + 1)
  }, [element])

  useLayoutEffect(() => {
    const root = track.current!
    let width = root.clientWidth
    const observer = new root.ownerDocument.defaultView!.ResizeObserver(() => {
      if (width === root.clientWidth) return
      width = root.clientWidth
      update()
    })
    observer.observe(root)
    update()
    return () => observer.disconnect()
  }, [update])

  return <div {...attributes} data-blo-image-row>
    <div ref={track} data-blo-image-row-track onLoadCapture={update}>{children}</div>
  </div>
}
