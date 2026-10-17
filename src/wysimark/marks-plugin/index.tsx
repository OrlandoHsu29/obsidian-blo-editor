import { cleanInlineStyle } from "../../blocks/typography"
import { clsx } from "clsx"
import { Editor, Path, Range, Text, Transforms } from "slate"

import {
  createHotkeyHandler,
  createPlugin,
  TypedPlugin,
} from "../sink"

import { createMarksMethods } from "./methods"
import { NON_MARK_TEXT_KEYS, withoutNonMarkTextKeys } from "./non-mark-keys"
import { $MarksSpan } from "./styles"

export type MarksEditor = {
  /**
   * IMPORTANT:
   *
   * This cannot be named `marks` because it conflicts with the `editor.marks`
   * built into the BaseEditor.j
   */
  marksPlugin: ReturnType<typeof createMarksMethods>
  activeMarks?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strike?: boolean
    highlight?: boolean
  }
}

export type MarksText = {
  text: string
  /** A source Markdown soft break, rather than an explicit line break. */
  softBreak?: true
  html?: true
  /** The identifier of a footnote reference; the text is only its label. */
  footnote?: string
  kbd?: true
  sup?: true
  sub?: true
  bold?: true
  italic?: true
  underline?: true
  strike?: true
  highlight?: true
  inlineStyle?: string
}

export type MarksPluginCustomTypes = {
  Name: "marks"
  Editor: MarksEditor
  Text: MarksText
}

/**
 * Footnote references, soft breaks and raw inline HTML are stored as leaves
 * whose whole text is serialized specially. Text typed at their edge must go
 * into a new sibling leaf; otherwise it would become part of the footnote
 * identifier, the soft break, or the unescaped HTML source.
 *
 * Typing inside raw HTML (not at an edge) still edits the HTML source.
 */
function insertTextBesideStructuralLeaf(editor: Editor, text: string): boolean {
  const { selection } = editor
  if (!selection || !Range.isCollapsed(selection)) return false
  const { path, offset } = selection.anchor
  const [leaf] = Editor.leaf(editor, path)
  if (!NON_MARK_TEXT_KEYS.some((key) => leaf[key])) return false
  const atStart = offset === 0
  const atEnd = offset === leaf.text.length
  if (leaf.html && !atStart && !atEnd) return false
  const marks = withoutNonMarkTextKeys(
    editor.marks ?? Editor.marks(editor) ?? {}
  ) as Omit<Text, "text">
  Transforms.insertNodes(
    editor,
    { ...marks, text },
    { at: atStart && !atEnd ? path : Path.next(path), select: true }
  )
  editor.marks = null
  return true
}

export const MarksPlugin = createPlugin<MarksPluginCustomTypes>((editor) => {
  editor.marksPlugin = createMarksMethods(editor)
  editor.activeMarks = {}
  const hotkeys = {
    "mod+b": editor.marksPlugin.toggleBold,
    "mod+i": editor.marksPlugin.toggleItalic,
    "mod+u": editor.marksPlugin.toggleUnderline,
    "super+k": editor.marksPlugin.toggleStrike,
    ...(!editor.wysimark.disableHighlight && {
      "mod+h": editor.marksPlugin.toggleHighlight,
    }),
  }
  const hotkeyHandler = createHotkeyHandler(hotkeys)
  // Override insertText to apply active marks
  const { insertText: defaultInsertText } = editor
  editor.insertText = (text) => {
    if (editor.activeMarks && Object.keys(editor.activeMarks).length > 0) {
      const { activeMarks } = editor
      // Apply marks before inserting text
      Object.entries(activeMarks).forEach(([mark, isActive]) => {
        if (isActive) {
          editor.addMark(mark, true)
        }
      })
    }
    if (editor.marks) editor.marks = withoutNonMarkTextKeys(editor.marks)
    if (insertTextBesideStructuralLeaf(editor, text)) return
    defaultInsertText(text)
  }

  // Override removeMarks to clear activeMarks at line end
  const { removeMarks } = editor.marksPlugin
  editor.marksPlugin.removeMarks = () => {
    removeMarks()
    if (editor.selection && Range.isRange(editor.selection)) {
      const point = editor.selection.focus
      const isAtLineEnd = Editor.after(editor, point) === null ||
        Editor.isEnd(editor, point, Editor.end(editor, []))
      if (isAtLineEnd) {
        editor.activeMarks = {}
      }
    }
  }

  return {
    name: "marks",
    editableProps: {
      renderLeaf: ({ leaf, children }) => {
        const inlineStyle=cleanInlineStyle(leaf.inlineStyle)
        if (leaf.footnote) children = <sup>{children}</sup>
        if (leaf.kbd) children = <kbd>{children}</kbd>
        if (leaf.sup) children = <sup>{children}</sup>
        if (leaf.sub) children = <sub>{children}</sub>
        return (
          <$MarksSpan
            style={inlineStyle ? Object.fromEntries(inlineStyle.split(';').filter(Boolean).map(part => {
              const at = part.indexOf(':');
              return [part.slice(0, at).replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase()), part.slice(at + 1)];
            })) : undefined}
            className={clsx({
              "--bold": leaf.bold,
              "--italic": leaf.italic,
              "--underline": leaf.underline,
              "--strike": leaf.strike,
              "--highlight": leaf.highlight,
            })}
          >
            {children}
          </$MarksSpan>
        )
      },
      onKeyDown: (e) => {
        if (hotkeyHandler(e)) return true
        // if (
        //   autocompleteMarker(editor, e, {
        //     triggerMarker: "`",
        //     regexp: /([`])(\S.*?)([`])$/,
        //     mark: "code",
        //   })
        // ) {
        //   return true
        // }
        // if (
        //   autocompleteMarker(editor, e, {
        //     triggerMarker: "*",
        //     regexp: /([*])(.+?)([*])$/,
        //     mark: "italic",
        //   })
        // ) {
        //   return true
        // }
        return false
      },
    },
  }
}) as TypedPlugin<MarksPluginCustomTypes>

