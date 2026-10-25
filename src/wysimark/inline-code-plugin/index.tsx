import { Editor, Element, Node, Path, Point, Range, Text, Transforms } from "slate"
import { HistoryEditor } from "slate-history"
import { createHotkeyHandler, createPlugin, TypedPlugin } from "../sink"
import { materializeTextBoundary } from "../../blocks/boundary"
import { InlineCode } from "./render-element"
import type { InlineCodeElement, InlineCodePluginCustomTypes } from "./types"
export * from "./styles"
export * from "./types"

const isCode = (node: unknown): node is InlineCodeElement => Element.isElement(node) && node.type === 'inline-code'

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
      HistoryEditor.withNewBatch(editor, () => Editor.withoutNormalizing(editor, () => {
        if (Range.isCollapsed(editor.selection!)) {
          const code = entry()
          if (code) { Transforms.unwrapNodes(editor, { at: code[1] }); return }
          materializeTextBoundary(editor)
          const { code: _code, ...marks } = Editor.marks(editor) ?? {}
          Transforms.insertNodes(editor, { type: 'inline-code', children: [{ ...marks, text: '' }] }, { select: true })
          return
        }
        const leaves = [...Editor.nodes<Text>(editor, { match: Text.isText })].filter(([text]) => text.text.length > 0)
        if (!leaves.length) return
        const allCode = leaves.every(([, at]) => Editor.above(editor, { at, match: isCode }))
        if (allCode) Transforms.unwrapNodes(editor, { match: isCode, split: true })
        else Transforms.setNodes(editor, { code: true }, { match: Text.isText, split: true })
        editor.marks = null
      }))
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
    renderEditable: ({ attributes, Editable }) => <Editable {...attributes} onBlur={event => {
      attributes.onBlur?.(event)
      if (!editor.wysimark.readOnly && !event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) cancelEmpty()
    }} />,
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
        if (code) {
          if (!Point.equals(point, backward ? Editor.start(editor, code[1]) : Editor.end(editor, code[1]))) return false
          const target = backward ? Editor.before(editor, code[1]) : Editor.after(editor, code[1])
          if (!target) return false
          Transforms.select(editor, target)
        } else {
          const [text] = Editor.leaf(editor, point)
          if (point.offset !== (backward ? 0 : text.text.length)) return false
          const sibling = [...point.path.slice(0, -1), point.path.at(-1)! + (backward ? -1 : 1)]
          if (sibling.at(-1)! < 0 || !Node.has(editor, sibling) || !isCode(Node.get(editor, sibling))) return false
          Transforms.select(editor, backward ? Editor.end(editor, sibling) : Editor.start(editor, sibling))
        }
        event.preventDefault(); return true
      },
    },
  }
}) as TypedPlugin<InlineCodePluginCustomTypes>
