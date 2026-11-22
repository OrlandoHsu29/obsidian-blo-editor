import { useCallback, useSyncExternalStore } from 'react'
import { Element } from 'slate'
import { ReactEditor, useSlateSelector, useSlateStatic } from 'slate-react'
import { rootCache } from './model'
import { hasMultipleImagesSelected, isWholeBlockSelected, subscribeBlockSelection } from './selection'
import { mixedRangeCoversTable } from '../wysimark/table-plugin/mixed-selection'

/** Follow both native ranges and disjoint image selections, including when
 * another image is removed while the focused image stays selected. */
export function useMultipleImagesSelected(): boolean {
  const editor = useSlateStatic()
  const snapshot = useSyncExternalStore(
    useCallback(listener => subscribeBlockSelection(editor, listener), [editor]),
    useCallback(() => hasMultipleImagesSelected(editor), [editor]),
    () => false,
  )
  return useSlateSelector(useCallback(editor => hasMultipleImagesSelected(editor), [snapshot]))
}

export function useBlockSelection(element: Element): boolean {
  const editor = useSlateStatic()
  const snapshot = useSyncExternalStore(
    useCallback(listener => subscribeBlockSelection(editor, listener), [editor]),
    useCallback(() => {
      const index=rootCache(editor).indices.get(element)
      return index!==undefined&&isWholeBlockSelected(editor,index)
    }, [editor,element]),
    () => false,
  )
  return useSlateSelector(useCallback(editor => {
    const index = rootCache(editor).indices.get(element)
    if (index !== undefined && snapshot && isWholeBlockSelected(editor, index)) return true
    return element.type === 'table' && !!editor.selection &&
      mixedRangeCoversTable(editor, index === undefined ? ReactEditor.findPath(editor, element) : [index], editor.selection)
  }, [element, snapshot]))
}
