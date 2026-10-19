import styled from "@emotion/styled"

export const $ImageBlock = styled("div")`
  display: block;
  /* RootBlock already owns the document spacing. */
  margin: 0;
  > [data-blo-image] { vertical-align: top; }
`
