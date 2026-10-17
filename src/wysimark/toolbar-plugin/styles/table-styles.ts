import styled from "@emotion/styled"

import { $Panel } from "../../shared-overlays"

export const $TableDialog = styled($Panel)`
  padding: 12px;
`
export const $TableDialogGrid = styled("div")`
  display: grid;
  grid-template-columns: repeat(5, 1.75em);
  grid-template-rows: 1.5em;
  /* grid-gap: 1px; */
`
export const $TableDialogGridCell = styled("div")`
  background: var(--background-modifier-hover);
  height: 1.5em;
  border-radius: 0.125em;
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  &.--selected {
    background: var(--interactive-accent);
  }
`
