import { Menu } from 'obsidian'
import type { Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import { ui } from '../wysimark/utils/translations'
import { blockDepth, changeBlockIndent, indentSelectedBlocks } from './model'

/** Both mouse buttons use the same native menu and the existing block selection. */
export function showBlockMenu(editor: Editor, index: number, anchor: HTMLElement) {
  const menu = new Menu()
  const indent = (delta: 1 | -1) => {
    changeBlockIndent(editor, index, delta)
    ReactEditor.focus(editor)
  }

  menu.addItem(item => item
    .setTitle(ui('缩进为子块'))
    .setIcon('indent-increase')
    .onClick(() => indent(1)))
  menu.addItem(item => item
    .setTitle(ui('减少缩进'))
    .setIcon('indent-decrease')
    .setDisabled(blockDepth(editor.children[index]) === 0)
    .onClick(() => indent(-1)))

  // Tab must still indent the selected block while its menu has keyboard focus.
  const document = anchor.ownerDocument
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
    event.preventDefault()
    event.stopImmediatePropagation()
    menu.hide()
    indentSelectedBlocks(editor, event.shiftKey ? -1 : 1)
    ReactEditor.focus(editor)
  }
  menu.onHide(() => document.removeEventListener('keydown', onKeyDown, true))
  document.addEventListener('keydown', onKeyDown, true)
  const rect = anchor.getBoundingClientRect()
  menu.showAtPosition({ x: rect.right + 4, y: rect.top }, document)
  return menu
}
