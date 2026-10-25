import type { Literal } from "mdast"

interface InlineMath extends Literal { type: "inlineMath" }
interface Math extends Literal { type: "math"; meta?: string | null }

// The editor also supports legacy MDAST nodes; expose the new parser's math
// nodes to that type map without upgrading unrelated parsing code.
declare module "mdast" {
  interface BlockContentMap { math: Math }
  interface PhrasingContentMap { inlineMath: InlineMath }
}
