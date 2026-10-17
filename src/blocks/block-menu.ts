import { Menu } from 'obsidian'
import type { Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import { ui } from '../wysimark/utils/translations'
import { blockDepth, changeBlockIndent, deleteBlockGroup, indentSelectedBlocks } from './model'

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

  menu.addSeparator()
  menu.addItem(item => item
    .setTitle(ui('删除块'))
    .setIcon('trash-2')
    .onClick(() => {
      deleteBlockGroup(editor, index)
      ReactEditor.focus(editor)
    }))

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
  const window = document.defaultView!
  const existingMenus = new Set(document.querySelectorAll('.menu'))
  // Start at the viewport edge to measure the native DOM menu unconstrained
  // by space below the block. Reposition synchronously before the first paint.
  menu.setUseNativeMenu(false)
  menu.showAtPosition({ x: anchor.getBoundingClientRect().left, y: 8 }, document)
  const popup = Array.from(document.querySelectorAll<HTMLElement>('.menu'))
    .find(element => !existingMenus.has(element))
  const position = () => {
    if (!popup || !anchor.isConnected) return
    const handle = anchor.getBoundingClientRect()
    const block = anchor.closest('[data-wysimark-block]')?.getBoundingClientRect() ?? handle
    const gap = 12, edge = 8
    const height = popup.scrollHeight + popup.offsetHeight - popup.clientHeight
    const above = Math.max(0, block.top - gap - edge)
    const below = Math.max(0, window.innerHeight - block.bottom - gap - edge)
    const placeAbove = above >= height || above >= below
    const maxHeight = Math.min(height, placeAbove ? above : below)
    const width = popup.getBoundingClientRect().width
    popup.style.boxSizing = 'border-box'
    popup.style.left = `${Math.max(edge, Math.min(handle.left, window.innerWidth - width - edge))}px`
    popup.style.top = `${placeAbove ? block.top - gap - maxHeight : block.bottom + gap}px`
    popup.style.maxHeight = `${maxHeight}px`
    popup.style.overflowY = 'auto'
  }
  position()
  document.addEventListener('keydown', onKeyDown, true)
  document.addEventListener('scroll', position, true)
  window.addEventListener('resize', position)
  menu.onHide(() => {
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('scroll', position, true)
    window.removeEventListener('resize', position)
  })
  return menu
}
