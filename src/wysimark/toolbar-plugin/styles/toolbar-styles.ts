import styled from "@emotion/styled"

export const $ToolbarContainer = styled("div")`
  /**
   * This flex rule applies to the "display: flex;" of the parent container.
   * Ensures the toolbar does not shrink or grow vertically.
   */
  flex: 0 0 auto;
  /**
   * If "position: sticky;" is not working, check the ancestor for "overflow:
   * hidden;" of any kind. This will stop sticky from working. A good workaround
   * is to use "overflow: clip;" instead.
   *
   * https://stackoverflow.com/a/73051006
   */
  position: sticky;
  top: 10px;
  z-index: 2;
  background: var(--background-secondary);
  /* font-size: 0.875em; */
  font-size: 0.9375em;
  padding: 0 0.5em;
  border: 1px solid var(--background-modifier-border);
  border-radius: 12px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, .16);
  align-self: center;
  width: max-content;
  max-width: min(880px, calc(100% - 32px));
  /**
   * Prevent clicks from stealing focus from the editor
   */
  user-select: none;
  /**
   * Extreme attention to detail. When the sticky is ending and the toolbar
   * is stuck to the bottom of the editor, setting margin-bottom to -1px will
   * fix the 2px bottom border and make it the proper 1px.
   */
  margin: 10px 16px 6px;

  /**
   * NOTE: The space in the equation is significant
   */
  height: calc(
    3em + 1px
  ); // $ToolbarDivider height + border-bottom of 1px above
  overflow-x: auto;
  overflow-y: hidden;
`

export const $Toolbar = styled("div")`
  white-space: nowrap;
  display: inline-block;
  height: calc(
    3em + 1px
  ); // $ToolbarDivider height + border-bottom of 1px above
`

export const $ToolbarDividerContainer = styled("div")`
  display: inline-block;
  height: 3em;
  padding: 0 0.375em;
`

export const $ToolbarDivider = styled("div")`
  display: inline-block;
  background: var(--shade-300);
  opacity: 50%;
  width: 1px;
  height: 3em;
`

export const $ToolbarButton = styled("div")`
  box-sizing: border-box;
  position: relative;
  display: inline-block;
  vertical-align: top;
  font-size: 1.25em;
  margin-top: 0.25em;
  height: 2em;
  padding: 0.375em 0.375em;
  border-radius: 0.25em;
  text-align: center;
  color: var(--shade-500);
  transition: all 100ms;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0);
  &.--disabled {
    opacity: 0.3;
    cursor: default;
    pointer-events: none;
  }
  &.--active {
    color: var(--text-on-accent, var(--blue-700));
    background: var(--interactive-accent, var(--blue-100));
    border-color: var(--interactive-accent, var(--blue-300));
    svg {
      /* stroke-width: 2px; */
    }
  }
  svg {
    stroke-width: 1.5px;
  }
  @media (hover: hover) {
    &:not(.--disabled):hover {
      color: var(--shade-700);
      background: var(--blue-100);
      svg {
        /* stroke-width: 2px; */
      }
    }
    &.--active:hover {
      color: var(--text-on-accent, var(--blue-700));
      background: var(--interactive-accent-hover, var(--blue-200));
    }
  }

  &.--more {
    padding: 0.375em 0.5em;
    &::after {
      content: "";
      position: absolute;
      left: 50%;
      bottom: -1px;
      transform: translateX(-50%);
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--interactive-accent);
      clip-path: polygon(0% 0%, 50% 0%, 100% 0%, 100% 100%, 50% 100%, 0% 100%);
      transition: width 160ms ease, height 160ms ease, border-radius 160ms ease, clip-path 160ms ease;
      pointer-events: none;
    }
    &:hover::after {
      width: 14px;
      height: 6px;
      border-radius: 0;
      clip-path: polygon(0% 0%, 50% 58.3333%, 100% 0%, 100% 41.6667%, 50% 100%, 0% 41.6667%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    &.--more::after { transition: none; }
  }
`
