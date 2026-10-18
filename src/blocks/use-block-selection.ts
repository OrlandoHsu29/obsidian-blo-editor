import { useCallback, useSyncExternalStore } from 'react'
import { Element } from 'slate'
import { useSlateSelector, useSlateStatic } from 'slate-react'
import { rootCache } from './model'
import { blockSelectionSnapshot, isWholeBlockSelected, subscribeBlockSelection } from './selection'

export function useBlockSelection(element: Element): boolean {
  const editor = useSlateStatic()
  const snapshot = useSyncExternalStore(
    useCallback(listener => subscribeBlockSelection(editor, listener), [editor]),
    useCallback(() => blockSelectionSnapshot(editor), [editor]),
    () => undefined,
  )
  return useSlateSelector(useCallback(editor => {
    const index = rootCache(editor).indices.get(element)
    return !!snapshot && index !== undefined && isWholeBlockSelected(editor, index)
  }, [element, snapshot]))
}
