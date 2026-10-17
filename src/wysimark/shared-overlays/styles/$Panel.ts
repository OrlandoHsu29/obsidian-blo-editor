import styled from "@emotion/styled"

import { SinkReset } from "../../sink/editable"

/**
 * $Panel is a nice box that goes around a Drop Down menu or a Dialog Box.
 *
 * We don't use $Panel directly and instead we extend it.
 *
 * The $Panel itself extends the `SinkReset` and we do this because the
 * Component appears at the root. So any styling, for example like from
 * Bootstrap or Material UI will affect what's in the Panel.
 */
export const $Panel = styled(SinkReset)`
  position: absolute;
  z-index: var(--layer-menu, 65);
  font-family: var(--font-interface);
  font-size: var(--font-ui-small);
  line-height: 1.5;
  padding: 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 10px;
  overflow: clip;
  box-shadow: var(--shadow-s);
  background: var(--background-secondary);
  color: var(--text-normal);
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
  /**
   * If you are tempted to add the transitions back in, here's why we left
   * them off:
   *
   * - When we initially unhide the panel (by setting a negative 'left' pos)
   *   the panel slides in very quickly. So we'd need to fix this first which
   *   adds complexity.
   *
   * - Even if we fixed it, the browser window updates the scrolls and resizes
   *   in a stepped manner (i.e. like frames in an animation). Keeping the
   *   smooth animations makes the panel step in sync with the page refreshes
   *   and so actually looks better.
   *
   * In other words, there's a technical issue we'd still need to solve but
   * even if we did, it looks better this way.
   */
  /* transition: left 100ms, top 100ms; */
`
