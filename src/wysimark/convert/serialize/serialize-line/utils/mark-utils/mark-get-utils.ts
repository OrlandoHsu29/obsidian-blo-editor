import { Text as SlateText } from "slate"

import { MarkKey, Segment, Text } from "../../../../types"
import { isNonMarkTextKey } from "../../../../../marks-plugin/non-mark-keys"
import { isPlainSpace, isText } from "../is-utils"

/**
 * Gets all the marks in current `Text`
 */
export function getMarksFromText(text: Text): MarkKey[] {
  return Object.keys(text).filter(
    (key) => key !== "text" && key !== "inlineStyle" && !isNonMarkTextKey(key)
  ) as MarkKey[]
}

/**
 * Gets all the marks from the current segment
 */
export function getMarksFromSegment(segment: Segment): MarkKey[] {
  if (SlateText.isText(segment)) {
    if (isPlainSpace(segment)) {
      throw new Error(
        `You probably didn't mean to do this. We should only be getting marks from segments that are not plain space segments.`
      )
    }
    return getMarksFromText(segment)
  } else if (segment.type === "anchor") {
    return getCommonAnchorMarks(segment.children as Segment[])
  } else {
    // Other inline elements serialize their own content and formatting.
    return []
  }
}

export function getCommonAnchorMarks(segments: Segment[]): MarkKey[] {
  let commonMarks: MarkKey[] | undefined
  for (const segment of segments) {
    if (!isText(segment)) continue
    if (isPlainSpace(segment)) continue
    const currentMarks = getMarksFromText(segment)
    if (commonMarks === undefined) {
      commonMarks = currentMarks
      continue
    }
    commonMarks = commonMarks.filter((commonMark) =>
      currentMarks.includes(commonMark)
    )
  }
  if (commonMarks === undefined) return []
  return commonMarks
}
