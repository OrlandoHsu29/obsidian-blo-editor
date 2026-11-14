import { Editor } from "slate"
import { selectBlockOrDocument } from '../../blocks/selection'
import { handleWordNavigation } from './word-navigation'

/** Run editor shortcuts before Obsidian's global commands consume them. */
export function handleScopedHotkey(editor: Editor, event: KeyboardEvent): boolean {
  // Embedded editors (for example the LaTeX input) own native text shortcuts.
  const target = event.target as HTMLElement | null
  if (target?.closest?.('input,textarea,select')) return false
  if (!event.isComposing && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a' && editor.wysimark.getBlockSelectShortcut?.()) {
    if (event.repeat || selectBlockOrDocument(editor)) { event.preventDefault(); event.stopPropagation(); return true }
  }
  if (editor.wysimark.handleCommandHotkey?.(event)) return true
  return handleWordNavigation(editor, event)
}
