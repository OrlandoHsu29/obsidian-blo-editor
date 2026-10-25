import { Segment } from "../../types"
import { normalizeSegments } from "./normalize-segments"

/** Turn prose line breaks into blocks without losing marks or link targets. */
export function splitSegmentLines(segments: Segment[]): Segment[][] {
  const lines: Segment[][] = [[]]
  for (const segment of segments) {
    let parts: Segment[]
    if ("text" in segment && !segment.code && !segment.html) {
      const { softBreak: _softBreak, ...text } = segment
      parts = segment.text.split("\n").map(value => ({ ...text, text: value }))
    } else if ("type" in segment && segment.type === "anchor") {
      parts = splitSegmentLines(segment.children as Segment[]).map(children => ({ ...segment, children }))
    } else parts = [segment]
    parts.forEach((part, index) => {
      if (index) lines.push([])
      lines[lines.length - 1].push(part)
    })
  }
  return lines.map(normalizeSegments)
}
