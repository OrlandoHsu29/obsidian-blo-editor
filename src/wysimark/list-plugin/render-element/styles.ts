import styled from "@emotion/styled"


const $ListItem = styled("li")`
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  list-style-position: outside;
`

export const $UnorderedListItem = styled($ListItem)`
  position: relative;
  display: flex;
  align-items: baseline;
  list-style-type: none;
  .wysimark-list-content { flex: 1; min-width: 0; }
  .--list-item-icon {
    position: relative;
    top: calc(var(--wysimark-list-marker-center, 0.825em) - 0.825em);
    flex: 0 0 auto;
    align-self: flex-start;
    display: inline-grid;
    align-items: center;
    line-height: 1.65;
    svg { display: block; }
    color: var(--shade-600);
  }
`

export const $OrderedListItem = styled($ListItem)`
  position: relative;
  display: flex;
  align-items: baseline;
  .wysimark-list-content { flex: 1; min-width: 0; }
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

export const $TaskListItem = styled($UnorderedListItem)`
  .--list-item-icon {
    color: var(--shade-300);
    .theme-dark & { color: var(--text-muted); }
    .--checkmark {
      color: green;
      stroke-width: 3px;
    }
  }
`
