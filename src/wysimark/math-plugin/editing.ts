import { useCallback, useSyncExternalStore } from "react"
import type { Editor } from "slate"
import { ReactEditor } from "slate-react"
import type { MathElement } from "./types"

type Session = { key?: object; listeners: Set<() => void> }
const sessions = new WeakMap<Editor, Session>()
function session(editor: Editor): Session {
  let value = sessions.get(editor)
  if (!value) { value = { listeners: new Set() }; sessions.set(editor, value) }
  return value
}
export function editMath(editor: Editor, element?: MathElement) {
  const value = session(editor)
  value.key = element ? ReactEditor.findKey(editor, element) : undefined
  value.listeners.forEach(listener => listener())
}
export function useMathEditing(editor: Editor, element: MathElement) {
  const key = ReactEditor.findKey(editor, element)
  return useSyncExternalStore(useCallback(listener => {
    const value = session(editor)
    value.listeners.add(listener)
    return () => { value.listeners.delete(listener) }
  }, [editor]), useCallback(() => session(editor).key === key, [editor, key]), () => false)
}
