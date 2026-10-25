import { AnchorElement } from "../anchor-plugin"
import type { Element, Text } from "../entry"
import { ImageInlineElement } from "../image-plugin/types"
import type { NonMarkTextKey } from "../marks-plugin/non-mark-keys"
import type { InlineMathElement } from "../math-plugin/types"
import type { InlineCodeElement } from "../inline-code-plugin/types"

export { Element, Text }
export type Segment = Text | AnchorElement | ImageInlineElement | InlineMathElement | InlineCodeElement

export type MarkProps = Omit<Text, "text" | NonMarkTextKey>
export type MarkKey = keyof MarkProps
