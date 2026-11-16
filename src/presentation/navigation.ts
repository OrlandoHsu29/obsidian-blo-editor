type Session = { exit: () => Promise<void>; mountOverlay?: (element: HTMLElement) => void }
const sessions = new WeakMap<Document, Session>()

export function registerPresentationExit(doc: Document, exit: () => Promise<void>, mountOverlay?: Session['mountOverlay']): () => void {
  const session = { exit, mountOverlay }; sessions.set(doc, session)
  return () => { if (sessions.get(doc) === session) sessions.delete(doc) }
}

/** Keep a viewer inside the browser's fullscreen surface without changing the note. */
export function mountPresentationOverlay(element: HTMLElement): void { sessions.get(element.ownerDocument)?.mountOverlay?.(element) }

/** Body-level viewers and new tabs are outside an element fullscreen surface. */
export async function openOutsidePresentation(doc: Document, open: () => unknown): Promise<void> {
  const exit = sessions.get(doc)?.exit
  if (exit) await exit()
  await open()
}
