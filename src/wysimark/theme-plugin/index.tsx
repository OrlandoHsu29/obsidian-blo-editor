
import { createPlugin, TypedPlugin } from "../sink"


export type ThemeEditor = {
  theme: true
}

export type ThemePluginCustomTypes = {
  Name: "theme"
  Editor: ThemeEditor
}

export const ThemePlugin = createPlugin<ThemePluginCustomTypes>((editor) => {
  editor.theme = true
  return {
    name: "theme",
    editor: {},
    renderEditable: ({ attributes, Editable }) => {
      return (
        <>
          <Editable {...attributes} />
        </>
      )
    },
    editableProps: {},
  }
}) as TypedPlugin<ThemePluginCustomTypes>
