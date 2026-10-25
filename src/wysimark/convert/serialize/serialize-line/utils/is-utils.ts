import * as Slate from "slate"

import { Segment, Text } from "../../../types"
import { Node } from "../normalize-line/types"

/**
 * Is this a Text Node
 */
export function isText(segment: Node | undefined): segment is Text {
  return Slate.Text.isText(segment)
}

/** Include every inline kind; only line/anchor children need text normalization. */
export function isElement(
  segment: Node
): segment is Exclude<Node, Text> {
  return Slate.Element.isElement(segment)
}

/**
 * Identify this as a plain, non-code Text space. This is fairly specific
 * because we only want to manipulate non-code Text spaces. If the Text is
 * `code` then we can apply our marks next to it.
 *
 * - Does the passed in `Text` node made up of only one or more spaces
 * - The `Text` node must not be `code`
 */
export function isPlainSpace(segment: Segment): boolean {
  return (
    Slate.Text.isText(segment) && !!segment.text.match(/^[ \t]+$/) && !segment.code
  )
}
