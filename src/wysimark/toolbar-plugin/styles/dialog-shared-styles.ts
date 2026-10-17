import styled from "@emotion/styled"

export const $DialogButton = styled("div")`
  /* Center vertically and horizontally */
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  /* font-size: 1.25em; */
  min-height: 30px;
  padding: 5px 12px;
  text-align: center;
  color: var(--text-normal);
  background: var(--interactive-normal);
  border: 1px solid var(--background-modifier-border);
  box-shadow: var(--input-shadow);
  &:hover {
    background: var(--interactive-hover);
  }
  border-radius: var(--radius-s, 6px);
  svg {
    color: currentColor;
    font-size: 1.25em;
    stroke-width: 2px;
  }
`

export const $DialogHint = styled("div")`
  font-size: 0.875em;
  margin-top: 0.5em;
  color: var(--text-muted);
  line-height: 1.375;
`
