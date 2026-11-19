import { Editor, Element, Node, Transforms } from 'slate'
import { ReactEditor } from 'slate-react'

const SNAP_HEIGHT_DISTANCE = 8

/** Freeze the measured sibling widths for this gesture, then persist them only on commit. */
export function freezeImageRow(editor: Editor, element: Element) {
  const item = ReactEditor.toDOMNode(editor, element)
  const track = item.parentElement
  if (!track?.hasAttribute('data-blo-image-row-track')) return
  const items = Array.from(track.children).filter(child => child.hasAttribute('data-blo-image-item'))
  const measured = items.flatMap(child => {
    const image = child.querySelector<HTMLImageElement>('[data-blo-image] > img')
    if (!(child instanceof track.ownerDocument.defaultView!.HTMLElement) || !image?.offsetWidth) return []
    return [{ child, width: image.offsetWidth, height: image.offsetHeight,
      srcWidth: image.naturalWidth || image.offsetWidth, srcHeight: image.naturalHeight || image.offsetHeight }]
  })
  if (measured.length !== items.length) return
  const siblings = measured.filter(entry => entry.child !== item)
  const index = measured.findIndex(entry => entry.child === item)
  const adjacent = [measured[index - 1], measured[index + 1]]
  const space = Array.from(track.querySelectorAll<HTMLElement>(':scope > [data-blo-image-gap]')).reduce((sum,gap)=>sum+gap.offsetWidth,0)
  const maxWidth = track.clientWidth - space - siblings.reduce((sum, entry) => sum + entry.width, 0)
  const setWidth = (child: HTMLElement, width: number) => {
    child.style.setProperty('--blo-image-drag-width', `${width}px`)
  }
  return {
    maxWidth,
    snapWidth(width: number, aspect: number, minWidth: number, maxWidth: number): number {
      let closest = SNAP_HEIGHT_DISTANCE
      let snapped = width
      for (const neighbor of adjacent) {
        if (!neighbor) continue
        const candidate = Math.round(neighbor.height * aspect)
        const distance = Math.abs(neighbor.height - width / aspect)
        if (candidate >= minWidth && candidate <= maxWidth && distance <= closest) {
          closest = distance
          snapped = candidate
        }
      }
      return snapped
    },
    preview(width: number) {
      for (const entry of siblings) setWidth(entry.child, entry.width)
      setWidth(item, width)
      track.setAttribute('data-blo-image-row-resizing', '')
    },
    commit() {
      for (const {child, ...size} of siblings) {
        if (!child.isConnected) continue
        const node = ReactEditor.toSlateNode(editor, child)
        const path = ReactEditor.findPath(editor, node)
        if (Node.has(editor, path) && Node.get(editor, path) === node) Transforms.setNodes(editor, size, { at: path })
      }
    },
    clear() {
      track.removeAttribute('data-blo-image-row-resizing')
      for (const {child} of measured) {
        child.style.removeProperty('--blo-image-drag-width')
      }
    },
  }
}
