import { createPlugin, TypedPlugin } from '../sink'
import { applyTextColor } from './methods/text-color'

// Run after any block-break handler, including lists, headings and tables.
// insertSoftBreak never reaches this callback and retains the block's color.
type ColorBoundaryTypes = { Name: 'color-boundary'; Editor: {} }
export const ColorBoundaryPlugin = createPlugin<ColorBoundaryTypes>(editor => ({
  name: 'color-boundary',
  editor: { insertBreak: () => () => applyTextColor(editor, null) },
})) as TypedPlugin<ColorBoundaryTypes>
