import { Editor, Range, Transforms } from "slate"
import { ReactEditor } from "slate-react"
import type { RenderLeafProps } from "slate-react"

import { createHotkeyHandler, createPlugin, TypedPlugin } from "../sink"

import { $InlineCode, $InvisibleSpan } from "./styles"
import { InlineCodePluginCustomTypes } from "./types"
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
    return {
      name: "inline-code",
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
            // Slate supplies its own outside caret while pending marks differ.
            // Another zero-width span here would hide that mark placeholder
            // from Slate's model-to-DOM point conversion.
            const hasOutsidePlaceholder = editor.marks != null && !editor.marks.code &&
              editor.selection && Editor.leaf(editor, editor.selection.anchor)[0] === text
            return (
              /**
               * Disable spellCheck because it's computer code usually.
               */
              <><$InlineCode spellCheck={false}>
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
          if (event.key === "ArrowLeft" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey &&
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
