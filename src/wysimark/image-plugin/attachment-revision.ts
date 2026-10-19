import { useCallback, useSyncExternalStore } from 'react'
import type { Editor } from 'slate'

type Resource = { revision: number; listeners: Set<() => void> }
const resources = new WeakMap<Editor, Map<string, Resource>>()
function resource(editor: Editor, url: string): Resource {
  let entries = resources.get(editor)
  if (!entries) { entries = new Map(); resources.set(editor, entries) }
  let entry = entries.get(url)
  if (!entry) { entry = { revision: 0, listeners: new Set() }; entries.set(url, entry) }
  return entry
}

/** Refresh only affected previews after their files are ready, without Slate operations. */
export function attachmentRestored(editor: Editor, urls: Iterable<string>): void {
  for (const url of urls) {
    const entry = resource(editor, url)
    entry.revision++
    for (const listener of entry.listeners) listener()
  }
}

export function useAttachmentRevision(editor: Editor, url: string): number {
  const subscribe = useCallback((listener: () => void) => {
    const entry = resource(editor, url)
    entry.listeners.add(listener)
    return () => { entry.listeners.delete(listener) }
  }, [editor, url])
  const snapshot = useCallback(() => resource(editor, url).revision, [editor, url])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
