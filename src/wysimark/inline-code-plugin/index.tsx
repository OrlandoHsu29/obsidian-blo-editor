import { Editor, Element, Path, Point, Range, Transforms } from "slate"
import { ReactEditor } from "slate-react"
import type { RenderLeafProps } from "slate-react"

import { createHotkeyHandler, createPlugin, TypedPlugin } from "../sink"

import { $InlineCode, $InvisibleSpan } from "./styles"
import { InlineCodePluginCustomTypes } from "./types"
import { cleanInlineStyle } from '../../blocks/typography'
export * from "./styles"
export * from "./types"

export const InlineCodePlugin = createPlugin<InlineCodePluginCustomTypes>(
  (editor) => {
    if (!editor.marksPlugin)
      throw new Error(
        "InlineCodePlugin has a dependency on the MarksPlugin but the MarksPlugin has not been added or is added after the InlineCodePlugin"
      )
    editor.inlineCode = {
      toggleInlineCode: () => editor.marksPlugin.toggleMark("code"),
    }
    const hotkeys = createHotkeyHandler({
      "mod+j": () => editor.inlineCode.toggleInlineCode(),
    })
    const outsideCode = () => {
      const selection = window.getSelection()
      const element = selection?.anchorNode?.parentElement
      return selection?.isCollapsed && !element?.closest('code') &&
        element?.closest('[data-inline-code-caret], [data-slate-mark-placeholder]')
    }
    const codeEnd = () => {
      if (!editor.selection || !Range.isCollapsed(editor.selection)) return false
      const point = editor.selection.anchor, [text] = Editor.leaf(editor, point)
      return !!text.code && point.offset === text.text.length
    }
    const leaveCode = () => {
      if (codeEnd()) Editor.removeMark(editor, "code")
    }
    const textBlock = (point: Point) => Editor.above(editor, {
      at: point, match: node => Element.isElement(node) && Editor.isBlock(editor, node), mode: "lowest",
    })
    const atBlockEdge = (edge: "start" | "end") => {
      if (!editor.selection || !Range.isCollapsed(editor.selection)) return false
      const point = editor.selection.anchor, block = textBlock(point)
      return !!block && (edge === "start" ? Editor.isStart(editor, point, block[1]) : Editor.isEnd(editor, point, block[1]))
    }
    return {
      name: "inline-code",
      editor: {
        deleteBackward: () => atBlockEdge("start") ? leaveCode : false,
        deleteForward: () => codeEnd() && atBlockEdge("end") ? leaveCode : false,
        deleteFragment: () => {
          if (!editor.selection || Range.isCollapsed(editor.selection)) return false
          const [start, end] = Range.edges(editor.selection), first = textBlock(start), last = textBlock(end)
          return first && last && !Path.equals(first[1], last[1]) ? leaveCode : false
        },
      },
      renderEditable: ({ attributes, Editable }) => <Editable {...attributes}
        onMouseUp={event => {
          attributes.onMouseUp?.(event)
          if (editor.wysimark.readOnly || !outsideCode()) return
          const selection = window.getSelection()
          const range = ReactEditor.toSlateRange(editor, selection!, { exactMatch: false, suppressThrow: true })
          const text = range && Range.isCollapsed(range) ? Editor.leaf(editor, range.anchor)[0] : null
          if (range && text?.code && range.anchor.offset === text.text.length) {
            Transforms.select(editor, range)
            Editor.removeMark(editor, "code")
          }
        }} />,
      editableProps: {
        renderLeaf: ({ leaf, text, children, leafPosition }: RenderLeafProps) => {
          if (leaf.code) {
            const colors = Object.fromEntries((cleanInlineStyle(leaf.inlineStyle)?.split(';') || []).map(part => {
              const colon = part.indexOf(':'); return [part.slice(0, colon), part.slice(colon + 1)]
            }))
            // Slate supplies its own outside caret while pending marks differ.
            // Another zero-width span here would hide that mark placeholder
            // from Slate's model-to-DOM point conversion.
            const hasOutsidePlaceholder = editor.marks != null && !editor.marks.code &&
              editor.selection && Editor.leaf(editor, editor.selection.anchor)[0] === text
            return (
              /**
               * Disable spellCheck because it's computer code usually.
               */
              <><$InlineCode spellCheck={false} style={{color: colors.color, backgroundColor: colors['background-color']}}>
                {/* These invisible spans are necessary. See comments for $InvisibleSpan. */}
                <$InvisibleSpan contentEditable={false}>|</$InvisibleSpan>
                {children}
              </$InlineCode>
                {/* A DOM-only caret stop outside the code; no character is
                    added to Slate text or saved Markdown. */}
                {!hasOutsidePlaceholder && (!leafPosition || leafPosition.isLast) &&
                  <span data-inline-code-caret data-slate-zero-width="z" data-slate-length={0}>{'\uFEFF'}</span>}
              </>
            )
          } else {
            return <>{children}</>
          }
        },
        onKeyDown: event => {
          if (event.key === "ArrowRight" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
              !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 &&
              !editor.wysimark.readOnly && codeEnd() && !outsideCode()) {
            leaveCode()
            event.preventDefault()
            return true
          }
          if (event.key === "ArrowLeft" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
              !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && !editor.wysimark.readOnly &&
              editor.selection && Range.isCollapsed(editor.selection) && outsideCode()) {
            const point = editor.selection.anchor
            const [text] = Editor.leaf(editor, point)
            if (!text.code || point.offset !== text.text.length) return hotkeys(event)
            const element = ReactEditor.toDOMNode(editor, text)
            const strings = element.querySelectorAll('code [data-slate-string]')
            const node = strings[strings.length - 1]?.firstChild
            if (!node) return false
            editor.marks = null
            Editor.addMark(editor, "code", true)
            const offset = node.textContent?.length || 0
            window.getSelection()?.setBaseAndExtent(node, offset, node, offset)
            event.preventDefault()
            return true
          }
          return hotkeys(event)
        },
      },
    }
  }
) as TypedPlugin<InlineCodePluginCustomTypes>
