import { Editor, Node, Range, Text, Transforms } from "slate"

export const DEFAULT_TEXT_COLOR = '#DF2A3F'

export function toggleTextColor(editor: Editor, color: string) {
  if (!editor.selection || editor.wysimark.readOnly) return
  const leaves = Range.isExpanded(editor.selection)
    ? Editor.fragment(editor, editor.selection).flatMap(node => Array.from(Node.texts(node)).map(([leaf]) => leaf)).filter(leaf => leaf.text.length)
    : [Editor.marks(editor) || {}]
  const active = leaves.length > 0 && leaves.every(leaf =>
    leaf.inlineStyle?.split(';').some(part => part.trim().toUpperCase() === `COLOR:${color.toUpperCase()}`))
  applyTextColor(editor, active ? null : color)
}

/** Replace just the foreground color, retaining background and other marks. */
export function withTextColor(style: string | undefined, color: string | null): string {
  const declarations = new Map((style || "").split(";").filter(Boolean).map(part => {
    const colon = part.indexOf(":")
    return [part.slice(0, colon).trim(), part.slice(colon + 1).trim()] as [string, string]
  }))
  declarations.delete("color")
  if (color) {
    if (!/^#[\da-f]{6}$/i.test(color)) throw new Error("Invalid text color")
    declarations.set("color", color.toUpperCase())
  }
  return Array.from(declarations, ([key, value]) => `${key}:${value}`).join(";")
}

export function applyTextColor(editor: Editor, color: string | null) {
  if (!editor.selection || editor.wysimark.readOnly) return
  if (Range.isCollapsed(editor.selection)) {
    const style = withTextColor(Editor.marks(editor)?.inlineStyle, color)
    if (style) Editor.addMark(editor, "inlineStyle", style)
    else Editor.removeMark(editor, "inlineStyle")
    return
  }
  const selection = editor.selection
  const leaves = Array.from(Editor.nodes<Text>(editor, { at: selection, match: Text.isText }))
  Editor.withoutNormalizing(editor, () => {
    // Reverse order keeps earlier paths stable when partial leaves are split.
    for (const [leaf, path] of leaves.reverse()) {
      if (Editor.above(editor, { at: path, match: node => !Text.isText(node) && 'type' in node && node.type === 'code-block' })) continue
      const at = Range.intersection(selection, Editor.range(editor, path))
      if (!at || Range.isCollapsed(at)) continue
      const style = withTextColor(leaf.inlineStyle, color)
      if (style) Transforms.setNodes(editor, { inlineStyle: style }, { at, match: Text.isText, split: true })
      else Transforms.unsetNodes(editor, "inlineStyle", { at, match: Text.isText, split: true })
    }
  })
}
