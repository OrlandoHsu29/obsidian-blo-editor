import styled from "@emotion/styled"

export const $CodeBlock = styled("div")`
  position: relative;
  background: var(--code-block-bgcolor);
  margin: var(--wysimark-block-spacing, 1em) 0;
  border-radius: 0.5em;
  border: 1px solid var(--code-block-border-color);
  /**
   * DO NOT REMOVE: Code for adding line numbering if enabled. See $CodeBlockLine
  * for more details.
   * counter-reset: line;
   */
  &.--selected {
    outline: 2px solid var(--select-color);
  }
  /**
   * NOTE: Required to make the border radius work on the first and last lines.
   * Otherwise they will be square.
   */
  overflow-x: hidden;
`

export const $CodeBlockActions = styled("div")`
  display: flex;
  gap: 0.25em;
`

export const $CodeBlockActionButton = styled("button")`
  box-sizing: border-box;
  width: 2em;
  height: 2em;
  min-height: 0;
  padding: 0;
  box-shadow: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 0.5em;
  color: var(--shade-700);
  background: var(--shade-200);
  font: inherit;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--shade-900);
    background: var(--shade-200);
  }
`

export const $CodeBlockScroller = styled("div")`
  padding: 1em;
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  border-radius: 0.5em;
  overflow-x: auto;
`

export const $CodeBlockLines = styled("div")`
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
`

export const $CodeBlockControls = styled("div")`
  font-size: 0.75em;
  line-height: 1;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.25em;
`

export const $CodeBlockLanguage = styled("span")`
  box-sizing: border-box;
  height: 2em;
  border: 1px solid transparent;
  cursor: pointer;
  width: max-content;
  display: flex;
  font-size: inherit;
  color: var(--shade-700);
  background: var(--shade-200);
  padding: 0 0.5em;
  border-radius: 0.5em;
  align-items: center;
  gap: 0.25em;
  span {
    text-align: left;
    flex: 0 0 auto;
  }
  svg {
    flex: 0 0 auto;
    position: relative;
  }
  &:hover {
    color: var(--shade-800);
    background: var(--shade-300);
  }
`

export const $CodeBlockLine = styled("div")`
  white-space: pre;
  line-height: 1.5em;
  counter-increment: line;
  font-family: "andale mono", AndaleMono, monospace;
  font-size: 0.875em;
  /*
    DO NOT REMOVE: Code for adding line numbering.
    TODO: Make optional in future.
    */
  /* &:before {
    content: counter(line);
    color: rgba(0, 0, 0, 0.25);
    border-right: 1px solid rgba(0, 0, 0, 0.05);
    margin-right: 1em;
    padding: 0em 1em 0 0;
    text-align: right;
    display: inline-block;
    width: 2em;
  } */
`
