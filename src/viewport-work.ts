type Work = { load: () => void | Promise<void>; suspend?: () => void; resume?: () => void }
type Entry = { host: HTMLElement; work: Work; near: boolean; priority: number; started: boolean; paused: boolean; revision: number; loading?: Promise<void> }
const queues = new WeakMap<HTMLElement, ReturnType<typeof createViewportWorkQueue>>()
export const VIEWPORT_IDLE_MS = 300

/** Shared by heavy embeds: no polling, one load/resume per idle frame. */
export function createViewportWorkQueue(scroller: HTMLElement) {
  const win = scroller.ownerDocument.defaultView!, entries = new Map<HTMLElement, Entry>(), pending = new Set<Entry>()
  let frame = 0, timer = 0, idleUntil = 0
  const request = () => {
    if (!pending.size || frame || timer) return
    const wait = idleUntil - win.performance.now()
    if (wait > 0) timer = win.setTimeout(() => { timer = 0; request() }, wait)
    else frame = win.requestAnimationFrame(pump)
  }
  const run = (entry: Entry) => {
    const revision = ++entry.revision
    entry.paused = false
    const finish = () => { if (entries.get(entry.host) === entry && entry.revision === revision) delete entry.host.dataset.bloRenderPaused }
    try {
      if (!entry.started) {
        entry.started = true
        entry.loading = Promise.resolve(entry.work.load()).then(finish, error => { finish(); console.error('Blo viewport render failed', error) })
      } else { entry.work.resume?.(); finish() }
    } catch (error) { finish(); console.error('Blo viewport render failed', error) }
    return entry.loading
  }
  const pump = () => {
    frame = 0
    if (win.performance.now() < idleUntil) { request(); return }
    let next: Entry | undefined
    for (const entry of pending) if (!next || entry.priority < next.priority) next = entry
    if (next) { pending.delete(next); run(next) }
    request()
  }
  const intersection = new win.IntersectionObserver(changes => {
    for (const change of changes) {
      const entry = entries.get(change.target as HTMLElement)
      if (!entry) continue
      entry.near = change.isIntersecting
      if (entry.near) {
        const bounds = change.boundingClientRect, viewport = change.rootBounds
        entry.priority = viewport ? Math.max(viewport.top + 1000 - bounds.bottom, bounds.top - (viewport.bottom - 1000), 0) : 0
        if (!entry.started || entry.paused) pending.add(entry)
      } else {
        pending.delete(entry)
        if (!entry.paused) { ++entry.revision; entry.paused = true; entry.work.suspend?.() }
      }
    }
    request()
  }, { root: scroller, rootMargin: '1000px' })
  const scroll = () => {
    idleUntil = win.performance.now() + VIEWPORT_IDLE_MS
    win.clearTimeout(timer); timer = 0
    request()
  }
  scroller.addEventListener('scroll', scroll, { passive: true })
  return {
    add(host: HTMLElement, work: Work) {
      const entry: Entry = { host, work, near: false, priority: 0, started: false, paused: true, revision: 0 }
      entries.set(host, entry); host.dataset.bloRenderPaused = 'true'; intersection.observe(host)
      return () => {
        ++entry.revision; entries.delete(host); pending.delete(entry); intersection.unobserve(host); delete host.dataset.bloRenderPaused
        if (!entries.size) {
          intersection.disconnect(); win.cancelAnimationFrame(frame); win.clearTimeout(timer)
          frame = timer = 0; scroller.removeEventListener('scroll', scroll); queues.delete(scroller)
        }
      }
    },
    async flush(source: HTMLElement) {
      for (const entry of entries.values()) if (source.contains(entry.host) && entry.host.matches('.blo-drawing')) {
        pending.delete(entry)
        await run(entry)
      }
    },
  }
}

export function observeViewportWork(host: HTMLElement, work: Work) {
  const scroller = host.closest<HTMLElement>('.wysimark-editor-container')
  if (!scroller) { void work.load(); return () => {} }
  let queue = queues.get(scroller)
  if (!queue) { queue = createViewportWorkQueue(scroller); queues.set(scroller, queue) }
  return queue.add(host, work)
}

export async function flushViewportDrawings(source: HTMLElement) {
  const scroller = source.closest<HTMLElement>('.wysimark-editor-container')
  if (scroller) await queues.get(scroller)?.flush(source)
}
