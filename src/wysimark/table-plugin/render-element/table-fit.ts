type Fit = { width?: number }

/** Probe an isolated copy, yielding between widths instead of blocking a frame. */
export function* fitTableWidth(host: HTMLElement): Generator<void, Fit> {
  const scroll = host.querySelector<HTMLElement>('.blo-table-scroll')!
  const table = scroll.querySelector('table')!
  host.dataset.overflow = 'false'
  host.style.removeProperty('--blo-table-width')
  yield
  const available = scroll.clientWidth
  const font = parseFloat(host.ownerDocument.defaultView!.getComputedStyle(table).fontSize) || 16
  let rowLimit = 9 * font, heightLimit = Math.max(22.5 * font, table.rows.length * 3.25 * font)
  const comfortable = () => table.offsetHeight <= heightLimit && [...table.rows].every(row => row.offsetHeight <= rowLimit)
  let width: number | undefined
  if (!comfortable() || table.scrollWidth > available + 1) {
    host.dataset.overflow = 'true'
    let low = available, high = Math.max(available, Math.min(4096, Math.max(available * 4, (table.rows[0]?.cells.length || 1) * 1024)))
    host.style.setProperty('--blo-table-width', `${high}px`)
    yield
    heightLimit = Math.max(heightLimit, table.offsetHeight)
    rowLimit = Math.max(rowLimit, ...[...table.rows].map(row => row.offsetHeight))
    for (let step = 0; step < 7 && high - low > 8; step++) {
      const middle = (low + high) / 2
      host.style.setProperty('--blo-table-width', `${middle}px`)
      yield
      if (comfortable()) high = middle; else low = middle
    }
    width = Math.ceil(high)
    host.style.setProperty('--blo-table-width', `${width}px`)
    yield
    const wideHeight = table.offsetHeight
    host.style.setProperty('--blo-table-width', `${available}px`)
    yield
    if (table.offsetHeight <= wideHeight + 2 && table.scrollWidth <= available + 1) width = undefined
  }
  return { width }
}

/** The copy has no Slate identity, handlers or focusable controls. */
export function createTableMeasure(host: HTMLElement, width: number) {
  const doc = host.ownerDocument, win = doc.defaultView!
  const wrapper = doc.createElement('div')
  wrapper.className = 'wysimark-editor blo-table-measure'
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.inert = true
  const font = win.getComputedStyle(host)
  Object.assign(wrapper.style, { width: `${width}px`, fontFamily: font.fontFamily, fontSize: font.fontSize, lineHeight: font.lineHeight, fontWeight: font.fontWeight, fontStyle: font.fontStyle })
  const copy = host.cloneNode(true) as HTMLElement
  delete copy.dataset.tableLayout
  delete copy.dataset.tablePlaceholder
  copy.style.removeProperty('--blo-table-hold-height')
  copy.querySelector('.blo-table-placeholder')?.remove()
  // Reuse loaded styles/fonts instead of registering embedded SVG font faces
  // again, which can recursively invalidate every pending fit.
  copy.querySelectorAll('script,style').forEach(node => node.remove())
  // The measurement copy is offscreen; native lazy loading must not stall it.
  copy.querySelectorAll('img').forEach(image => { image.loading = 'eager' })
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
    for (const attr of [...node.attributes]) if (attr.name.startsWith('data-slate-') || ['contenteditable', 'tabindex', 'id'].includes(attr.name)) node.removeAttribute(attr.name)
  }
  wrapper.append(copy)
  ;(host.closest('.wysimark-container') ?? doc.body).append(wrapper)
  return { host: copy, dispose: () => wrapper.remove() }
}

// One costly layout probe per window/frame, even when several tables enter view.
const queues = new WeakMap<Window, { jobs: Set<() => void>; frame: number }>()
export function runTableFit(win: Window, iterator: Generator<void, Fit>, done: (fit: Fit) => void, failed: (error: unknown) => void): () => void {
  let queue = queues.get(win)
  if (!queue) { queue = { jobs: new Set(), frame: 0 }; queues.set(win, queue) }
  let cancelled = false
  const request = () => { if (queue!.jobs.size && !queue!.frame) queue!.frame = win.requestAnimationFrame(pump) }
  const pump = () => {
    queue!.frame = 0
    const next = queue!.jobs.values().next().value as (() => void) | undefined
    if (next) { queue!.jobs.delete(next); next() }
    request()
  }
  const advance = () => {
    if (cancelled) return
    try { const result = iterator.next(); if (result.done) done(result.value); else { queue!.jobs.add(advance); request() } }
    catch (error) { failed(error) }
  }
  queue.jobs.add(advance); request()
  return () => {
    cancelled = true; queue!.jobs.delete(advance)
    if (!queue!.jobs.size && queue!.frame) { win.cancelAnimationFrame(queue!.frame); queue!.frame = 0 }
  }
}
