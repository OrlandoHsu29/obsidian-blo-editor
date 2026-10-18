import { createHotkeyHandler, createPlugin, TypedPlugin } from "../sink"

import { HorizontalRule } from "./horizontal-rule"
import { createHorizontalRuleMethods } from "./methods"
import { insertBreak } from "./insert-break"
import { deleteSelectedRule } from "./delete-selected-rule"
import { HorizontalRulePluginCustomTypes } from "./types"
export * from "./types"

export const HorizontalRulePlugin =
  createPlugin<HorizontalRulePluginCustomTypes>(
    (editor, _options, { createPolicy }) => {
      editor.horizontalRule = createHorizontalRuleMethods(editor)
      return createPolicy({
        name: "horizontal-rule",
        editor: {
          insertBreak: () => insertBreak(editor),
          deleteBackward: () => deleteSelectedRule(editor),
          deleteForward: () => deleteSelectedRule(editor),
          isVoid(element) {
            if (element.type === "horizontal-rule") return true
          },
        },
        editableProps: {
          renderElement: (props) => {
            const element = props.element as { type: string }
            if (element.type === "horizontal-rule") {
              return <HorizontalRule {...props} />
            }
          },
          onKeyDown: createHotkeyHandler({
            "super+-": editor.horizontalRule.insertHorizontalRule,
          }),
        },
      })
    }
  ) as TypedPlugin<HorizontalRulePluginCustomTypes>
