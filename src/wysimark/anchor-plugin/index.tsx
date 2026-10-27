import { Descendant } from "slate"

import { createPlugin, curryOne } from "../sink"

import { TypedPlugin } from "../sink/types/plugin/plugin"
import { onPaste } from "./editable/on-paste"
import { createAnchorMethods } from "./methods"
import { normalizeNode } from "./normalize-node"
import { Anchor } from "./render-element/anchor"
import { handleLinkKey } from "./link-keyboard"

type AnchorMethods = ReturnType<typeof createAnchorMethods>

export type AnchorEditor = {
  anchor: AnchorMethods
}

export type AnchorElement = {
  type: "anchor"
  href: string
  target?: string
  title?: string
  markdownSyntax?: "literal" | "autolink"
  children: Descendant[]
}

export type AnchorPluginCustomTypes = {
  Name: "anchor"
  Editor: AnchorEditor
  Element: AnchorElement
}

export const AnchorPlugin = createPlugin<AnchorPluginCustomTypes>(
  (editor, _options, { createPolicy }) => {
    editor.anchor = createAnchorMethods(editor)
    return createPolicy({
      name: "anchor",
      editor: {
        isInline(element) {
          if (element.type === "anchor") return true
        },
        normalizeNode: curryOne(normalizeNode, editor),
      },
      editableProps: {
        onKeyDown: event => {
          if (editor.wysimark.readOnly || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
          if (!handleLinkKey(editor, event.key)) return false
          event.preventDefault()
          return true
        },
        onPaste: curryOne(onPaste, editor),
        renderElement: ({ element, attributes, children }) => {
          if (element.type === "anchor") {
            return (
              <Anchor element={element} attributes={attributes}>
                {children}
              </Anchor>
            )
          }
        },
      },
    })
  }
) as TypedPlugin<AnchorPluginCustomTypes>
