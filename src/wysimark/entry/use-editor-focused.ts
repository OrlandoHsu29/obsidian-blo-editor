import { useCallback, useSyncExternalStore } from "react"
import type { Editor } from "slate"
import { ReactEditor } from "slate-react"

type FocusStore = {
  listeners: Set<() => void>
  detach: () => void
}

/** One focus subscription per editor; a popout document is tracked too. */
const stores = new WeakMap<Editor, FocusStore>()

function attach(editor: Editor, store: FocusStore): boolean {
  try {
    const doc = ReactEditor.toDOMNode(editor, editor).ownerDocument
    const win = doc.defaultView
    const update = () => store.listeners.forEach(listener => listener())
    doc.addEventListener("focusin", update)
    doc.addEventListener("focusout", update)
    win?.addEventListener("focus", update)
    win?.addEventListener("blur", update)
    store.detach = () => {
      doc.removeEventListener("focusin", update)
      doc.removeEventListener("focusout", update)
      win?.removeEventListener("focus", update)
      win?.removeEventListener("blur", update)
    }
    return true
  } catch {
    // The editable is not mounted yet; the next subscriber retries.
    return false
  }
}

function subscribeFocused(editor: Editor, listener: () => void) {
  let store = stores.get(editor)
  if (!store) {
    const next: FocusStore = { listeners: new Set(), detach: () => {} }
    if (attach(editor, next)) {
      stores.set(editor, next)
      store = next
    } else {
      store = next
    }
  }
  store.listeners.add(listener)
  return () => {
    store!.listeners.delete(listener)
    if (!store!.listeners.size) {
      store!.detach()
      if (stores.get(editor) === store) stores.delete(editor)
    }
  }
}

/**
 * `useFocused` from slate-react listens on the main window's document, so an
 * editor inside a popout window (the quick memo panel) never reports focus.
 * Track the editor's own document instead and read slate-react's focus flag.
 */
export function useEditorFocused(editor: Editor): boolean {
  const subscribe = useCallback(
    (listener: () => void) => subscribeFocused(editor, listener),
    [editor]
  )
  const getSnapshot = useCallback(() => ReactEditor.isFocused(editor), [editor])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
