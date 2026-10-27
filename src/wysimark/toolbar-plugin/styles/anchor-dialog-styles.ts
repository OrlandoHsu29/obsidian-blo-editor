import styled from "@emotion/styled"

import { $Panel } from "../../shared-overlays/styles/$Panel"

export const $AnchorDialog = styled($Panel)`
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: auto;
`
export const $AnchorDialogInputLine = styled("div")`
  display: flex;
  gap: 0.5em;
`

export const $AnchorDialogInput = styled("input")`
  flex: 1 1 auto;
  min-width: 0;
`
