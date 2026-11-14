import { Editor, Element, Node, Path, Point, Range, Text, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { useEffect, useRef } from 'react'
import { startInlineCodeDrag } from './mouse-selection'
import { createHotkeyHandler, createPlugin, TypedPlugin } from "../sink"
import { materializeTextBoundary } from "../../blocks/boundary"
import { InlineCode } from "./render-element"

import type { InlineCodeElement, InlineCodePluginCustomTypes } from "./types"
export * from "./styles"
export * from "./types"

const isCode = (node: unknown): node is InlineCodeElement => Element.isElement(node) && node.type === 'inline-code'

/** Join only code whose text participates in this formatting operation. */
function mergeSelectedCode(editor: Editor) {
  if (!editor.selection || Range.isCollapsed(editor.selection)) return
  const refs = [...Editor.nodes<InlineCodeElement>(editor, { match: isCode })].filter(([, path]) => {
    const range = Range.intersection(editor.selection!, Editor.range(editor, path))
    return range && Range.isExpanded(range)
  }).map(([, path]) => Editor.pathRef(editor, path))
  try {
    Editor.withoutNormalizing(editor, () => {
      for (let i = refs.length - 1; i > 0; i--) {
        const left = refs[i - 1].current, right = refs[i].current
        if (!left || !right || !Path.equals(Path.parent(left), Path.parent(right))) continue
        const gap = right[right.length - 1] - left[left.length - 1]
        if (gap === 2) {
          const boundary = Node.get(editor, Path.next(left))
          if (!Text.isText(boundary) || boundary.text !== '') continue
          Transforms.removeNodes(editor, { at: Path.next(left) })
        } else if (gap !== 1) continue
        Transforms.mergeNodes(editor, { at: refs[i].current! })
      }
    })
  } finally { refs.forEach(ref => ref.unref()) }
}

export const InlineCodePlugin = createPlugin<InlineCodePluginCustomTypes>(editor => {
  const entry = () => editor.selection ? Editor.above<InlineCodeElement>(editor, { match: isCode }) : undefined
  const cancelEmpty = () => {
    const code = entry()
    if (!code || Node.string(code[0]) !== '') return false
    Transforms.removeNodes(editor, { at: code[1] })
    return true
  }
  // Empty code is an editable node, not a hidden mark on subsequent typing.
  // Selection movement through its real Slate boundary cancels the empty field.
  const { apply } = editor
  editor.apply = operation => {
    const code = operation.type === 'set_selection' && !editor.wysimark.readOnly ? entry() : undefined
    const ref = code && Node.string(code[0]) === '' ? Editor.pathRef(editor, code[1]) : undefined
    try {
      apply(operation)
      if (!ref?.current) return
      const current = entry()
      if ((!current || !Path.equals(current[1], ref.current)) && Node.has(editor, ref.current)) {
        Transforms.removeNodes(editor, { at: ref.current })
      }
    } finally { ref?.unref() }
  }
  editor.inlineCode = {
    toggleInlineCode: () => {
      if (editor.wysimark.readOnly || !editor.selection || Editor.above(editor, { match: n => Element.isElement(n) && n.type === 'code-block' })) return
      let addingCode = false
      HistoryEditor.withNewBatch(editor, () => {
        Editor.withoutNormalizing(editor, () => {
          if (Range.isCollapsed(editor.selection!)) {
            const code = entry()
            if (code) { Transforms.unwrapNodes(editor, { at: code[1] }); return }
            materializeTextBoundary(editor)
            const { code: _code, ...marks } = Editor.marks(editor) ?? {}
            Transforms.insertNodes(editor, { type: 'inline-code', children: [{ ...marks, text: '' }] }, { select: true })
            return
          }
          // An outside drag may touch adjacent prose at a zero-length endpoint.
          // Only selected characters determine the toggle and receive code marks.
          const leaves = [...Editor.nodes<Text>(editor, { match: Text.isText })].flatMap(([node, path]) => {
            const range = Range.intersection(editor.selection!, Editor.range(editor, path))
            if (!range || Range.isCollapsed(range)) return []
            const [start, end] = Range.edges(range)
            return [{ path, range, text: node.text.slice(start.offset, end.offset) }]
          })
          if (!leaves.length) return
          const at = { anchor: Range.start(leaves[0].range), focus: Range.end(leaves[leaves.length - 1].range) }
          // Boundary whitespace follows the text's style instead of changing the
          // toggle direction. A whitespace-only selection still toggles normally.
          const content = leaves.filter(({ text }) => text.trim().length > 0)
          const allCode = (content.length ? content : leaves).every(({ path }) => Editor.above(editor, { at: path, match: isCode }))
          if (allCode) Transforms.unwrapNodes(editor, { at, match: isCode, split: true })
          else {
            addingCode = true
            Transforms.setNodes(editor, { code: true }, { at, match: Text.isText, split: true })
          }
          editor.marks = null
        })
        // Code marks have now normalized into inline nodes. Keep this merge in
        // the same undo batch, without touching unselected neighboring code.
        if (addingCode) mergeSelectedCode(editor)
      })
    },
  }
  const hotkeys = createHotkeyHandler({ 'mod+j': () => editor.inlineCode.toggleInlineCode() })
  return {
    name: 'inline-code',
    editor: {
      isInline: element => isCode(element) ? true : undefined,
      normalizeNode: ([node, path]) => {
        // Accept old Slate clipboard fragments that used a code text mark.
        if (!Text.isText(node) || !node.code || !path.length) return false
        const parent = Node.parent(editor, path)
        if (Element.isElement(parent) && parent.type === 'code-block-line') return false
        Editor.withoutNormalizing(editor, () => {
          Transforms.unsetNodes(editor, 'code', { at: path })
          if (!isCode(parent)) Transforms.wrapNodes(editor, { type: 'inline-code', children: [] }, { at: path })
        })
        return true
      },
      deleteBackward: () => !editor.wysimark.readOnly && cancelEmpty(),
      deleteForward: () => !editor.wysimark.readOnly && cancelEmpty(),
      insertBreak: () => {
        if (editor.wysimark.readOnly || !editor.selection || !Range.isCollapsed(editor.selection)) return false
        const code = entry()
        if (!code || !Editor.isEnd(editor, editor.selection.anchor, code[1])) return false
        const after = Editor.after(editor, code[1])
        if (after) Transforms.select(editor, after)
        return false
      },
    },
    renderEditable: ({ attributes, Editable }) => {
      const drag = useRef<(() => void) | undefined>(undefined)
      useEffect(() => () => drag.current?.(), [])
      return <Editable {...attributes} onMouseDown={event => {
        drag.current?.()
        attributes.onMouseDown?.(event)
        if (!event.defaultPrevented) drag.current = startInlineCodeDrag(editor, event)
      }} onBlur={event => {
      drag.current?.()
      attributes.onBlur?.(event)
      if (!editor.wysimark.readOnly && !event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) cancelEmpty()
    }} />
    },
    editableProps: {
      renderElement: ({ element, attributes, children }) => isCode(element)
        ? <InlineCode element={element} attributes={attributes}>{children}</InlineCode> : undefined,
      onKeyDown: event => {
        if (editor.wysimark.readOnly || !editor.selection || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return false
        if (hotkeys(event)) return true
        if (!Range.isCollapsed(editor.selection)) return false
        const code = entry()
        if (event.key === 'Escape' && code) {
          const after = Editor.after(editor, code[1])
          if (after) Transforms.select(editor, after)
          event.preventDefault(); return true
        }
        if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return false
        const backward = event.key === 'ArrowLeft', point = editor.selection.anchor
        const nextCharacter = backward ? Editor.before(editor, point, { unit: 'character' }) : Editor.after(editor, point, { unit: 'character' })
        if (code) {
          const edge = backward ? Editor.start(editor, code[1]) : Editor.end(editor, code[1])
          if (!Point.equals(point, edge)) {
            if (!nextCharacter || !Path.isAncestor(code[1], nextCharacter.path)) {
              Transforms.select(editor, edge)
              event.preventDefault(); return true
            }
            return false
          }
          const sibling = [...code[1].slice(0, -1), code[1].at(-1)! + (backward ? -1 : 1)]
          if (sibling.at(-1)! < 0 || !Node.has(editor, sibling) || !Text.isText(Node.get(editor, sibling))) return false
          const target = backward ? Editor.end(editor, sibling) : Editor.start(editor, sibling)
          Transforms.select(editor, target)
        } else {
          const [text] = Editor.leaf(editor, point)
          const sibling = [...point.path.slice(0, -1), point.path.at(-1)! + (backward ? -1 : 1)]
          if (sibling.at(-1)! < 0 || !Node.has(editor, sibling) || !isCode(Node.get(editor, sibling))) return false
          const edge = { path: point.path, offset: backward ? 0 : text.text.length }
          if (!Point.equals(point, edge)) {
            if (!nextCharacter || !Path.equals(point.path, nextCharacter.path)) {
              Transforms.select(editor, edge)
              event.preventDefault(); return true
            }
            return false
          }
          Transforms.select(editor, backward ? Editor.end(editor, sibling) : Editor.start(editor, sibling))
        }
        event.preventDefault(); return true
      },
    },
  }
}) as TypedPlugin<InlineCodePluginCustomTypes>
