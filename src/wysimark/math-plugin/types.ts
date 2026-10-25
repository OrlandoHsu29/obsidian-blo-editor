import type { Text } from "slate"

export type InlineMathElement = { type: "math-inline"; latex: string; children: Text[] }
export type MathElement = InlineMathElement | { type: "math-block"; latex: string; children: Text[] }
export type MathPluginCustomTypes = {
  Name: "math"
  Element: MathElement
  Editor: { math: { insertInline: () => boolean } }
}
