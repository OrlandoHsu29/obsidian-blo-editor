type Chunk = { height?: number; skipped: boolean }
const registries = new WeakMap<Document, ReturnType<typeof createChunkVisibilityRegistry>>()

/** Preserve real geometry while Chromium skips offscreen layout and painting.
 * No scroll handler, reveal queue, or Slate node unmounting.
 */
export function createChunkVisibilityRegistry(doc: Document) {
  const chunks = new Map<HTMLElement, Chunk>()
  const observer = new doc.defaultView!.ResizeObserver(entries => {
    for (const { target, contentRect } of entries) {
      const root = target as HTMLElement, chunk = chunks.get(root)
      if (!chunk || chunk.skipped || contentRect.width <= 0 || chunk.height === contentRect.height) continue
      chunk.height = contentRect.height
      root.style.setProperty('--blo-chunk-height', chunk.height + 'px')
      root.dataset.bloChunkMeasured = 'true'
    }
  })
  const visibility = (event: Event) => {
    const root = event.currentTarget as HTMLElement, chunk = chunks.get(root)
    if (chunk) chunk.skipped = (event as Event & { skipped: boolean }).skipped
  }
  return {
    add(root: HTMLElement) {
      chunks.set(root, { skipped: false })
      observer.observe(root)
      root.addEventListener('contentvisibilityautostatechange', visibility)
      return () => {
        observer.unobserve(root)
        root.removeEventListener('contentvisibilityautostatechange', visibility)
        chunks.delete(root)
        if (!chunks.size) observer.disconnect()
      }
    },
  }
}
export function observeChunkVisibility(root: HTMLElement) {
  const doc = root.ownerDocument
  let registry = registries.get(doc)
  if (!registry) { registry = createChunkVisibilityRegistry(doc); registries.set(doc, registry) }
  return registry.add(root)
}
