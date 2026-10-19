import styled from "@emotion/styled"

/**
 * Table Menu
 */

const $BaseMenu = styled("div")`
  position: absolute;
  cursor: pointer;
  /**
   * very slightly shaded
   */
  background: rgba(0, 0, 0, 0.001);

  /**
   * hover 
   */
  &:hover {
    /**
     * needs to pop up so that it doesn't jump back and forth with neighbor
     * below
     */
    z-index: var(--layer-menu,65);
    /**
     * Makes the visible tile get darker on hover over any part of the
     * menu including the invisible part
     */
    .--tile {
      background: var(--background-modifier-hover);
    }
  }
`

export const $ColumnMenu = styled($BaseMenu)`
  /**
   * hangs out on top
   */
  left: -1px;
  right: -1px;
  right: 0;
  height: 20px;
  top: -20px;
`

export const $RowMenu = styled($BaseMenu)`
  /**
   * hangs out on left
   */
  top: -1px;
  bottom: -1px;
  width: 20px;
  left: -20px;
`

/**
 * Menu Tile
 */

const $MenuTile = styled("div")`
  position: absolute;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  transition: all 200ms;
  /**
   * NOTE: One of these should be overridden
   */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`

/**
 * The `$RowMenuTile` is the visible part of the `$RowMenu` and is the right
 * half of the `$RowMenu`.
 */
export const $ColumnMenuTile = styled($MenuTile)`
  top: 0;
  border-bottom: none;
  border-right: none;
  bottom: 1px;
  td:first-of-type & {
    border-top-left-radius: 0.5em;
  }
  td:last-of-type & {
    border-top-right-radius: 0.5em;
    border-right: 1px solid rgba(0, 0, 0, 0.05);
    right: -1px;
  }
  svg {
    position: absolute;
    top: 50%;
    transform:translateY(-50%);
    left: 50%;
    margin-left: -0.5em;
    color: var(--text-faint);
  }
  &:hover svg {
    color: var(--text-muted);
  }

  /* border-top-left-radius: 0.5em;
  border-top-right-radius: 0.5em; */
`

/**
 * The `$RowMenuTile` is the visible part of the `$RowMenu` and is the right
 * half of the `$RowMenu`.
 */
export const $RowMenuTile = styled($MenuTile)`
  left: 0;
  border-right: none;
  border-bottom: none;
  right: 1px;
  tr:first-of-type & {
    border-top-left-radius: 0.5em;
  }
  tr:last-of-type & {
    border-bottom-left-radius: 0.5em;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    bottom: 0;
  }
  svg {
    position: absolute;
    left: 50%;
    transform:translateX(-50%);
    top: 50%;
    margin-top: -0.5em;
    color: var(--text-faint);
  }
  &:hover svg {
    color: var(--text-muted);
  }

  /* border-top-left-radius: 0.5em;
  border-bottom-left-radius: 0.5em; */
`

/**
 * Menu Button
 */

