import { observeMediaResize } from './media-resize'

/** Suspend the SVG subtree during resizing, without rebuilding its preview. */
export function observeDrawingResize(host: HTMLElement, dragging = false): () => void {
  return observeMediaResize(host, { marker: 'drawingResizing', dragging }).dispose
}
