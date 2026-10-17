import styled from "@emotion/styled"


const $ListItem = styled("li")`
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  list-style-position: outside;
`

export const $UnorderedListItem = styled($ListItem)`
  position: relative;
  list-style-type: none;
  .--list-item-icon {
    position: absolute;
    top: var(--wysimark-list-marker-center, 0.75em);
    left: -1.375em;
    display: flex;
    align-items: center;
    line-height: 1;
    transform: translateY(-50%);
    svg { display: block; }
    color: var(--shade-600);
  }
`

export const $OrderedListItem = styled($ListItem)`
  position: relative;
  list-style-type: decimal;
  counter-increment: var(--list-item-var);

  &.--first-at-depth {
    counter-reset: var(--list-item-var);
    background: inherit;
  }

  /* Native markers share the first text line's baseline, including inline code. */
  &::marker {
    content: none;
    color: var(--shade-500);
    /* force numbers to be monospaced for better alignment */
    font-variant-numeric: tabular-nums;
  }
  &::before { content: none; }
`

export const $TaskListItem = styled($ListItem)`
  position: relative;
  list-style-type: none;
  .--list-item-icon {
    position: absolute;
    top: 0.25em;
    left: -1.5em;
    line-height: 1.5em;
    color: var(--shade-300);
    .--checkmark {
      color: green;
      stroke-width: 3px;
    }
  }
`
