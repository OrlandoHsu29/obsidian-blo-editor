import { Editor, Transforms } from "slate"
import { ReactEditor } from "slate-react"

import { ImageBlockElement } from "../../../../types"

export function convertToInlineImage(
  editor: Editor,
  element: ImageBlockElement
) {
  const path = ReactEditor.findPath(editor, element)
  Editor.withoutNormalizing(editor, () => {
    // Changing layout must preserve the current image dimensions.
    Transforms.setNodes(
      editor,
      { type: "image-inline" },
      { at: path }
    )
    Transforms.wrapNodes(
      editor,
      { type: "paragraph", children: [] },
      { at: path }
    )
  })
}
