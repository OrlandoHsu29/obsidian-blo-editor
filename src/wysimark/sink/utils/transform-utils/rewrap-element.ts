import { Editor, Element, NodeEntry, Path, Text, Transforms } from "slate"
import { blockDepth, reflowFollowingLists } from '../../../../blocks/model'

import {
  createTargetElement,
  TargetElement,
} from "../standardize-utils/target-element"

/**
 * Takes an existing Element at path `at` and swaps out that Element with a
 * new Element. It does this by unwrapping the Element and rewrapping it with
 * the new Element.
 *
 * This is useful because if we do it this way, we can preserve the selection.
 */
export function rewrapElement<T extends Element = Element>(
  editor: Editor,
  targetElement: TargetElement<T>,
  at: Path
) {
  Editor.withoutNormalizing(editor, () => {
    const originalEntry = Editor.node(editor, at) as NodeEntry<Element>
    const isList = (type: string) => ['ordered-list-item','unordered-list-item','task-list-item'].includes(type)
    const source = originalEntry[0]
    const nextElement = {
      ...createTargetElement(source, targetElement),
      ...(source.__blockDepth !== undefined || isList(source.type) ? { __blockDepth: blockDepth(source) } : {}),
    }
    if(originalEntry[0].__subtitle&&(nextElement.type==='paragraph'||isList(nextElement.type)))nextElement.__subtitle=true
    // Lists provide structure; a heading remains an independently editable child.
    if (originalEntry[0].type === 'heading' && isList(nextElement.type)) {
      Transforms.wrapNodes(editor, {...nextElement,blockChildren:true} as T, {at})
      reflowFollowingLists(editor,at,blockDepth(Editor.node(editor,at)[0]))
      return
    }
    if (isList(originalEntry[0].type) && nextElement.type === 'heading') {
      Transforms.wrapNodes(editor, nextElement as T, {
        at: Editor.range(editor,at),
        match: node => Text.isText(node) || (Element.isElement(node) && editor.isInline(node)),
        mode: 'highest',
      })
      Transforms.setNodes(editor,{blockChildren:true},{at})
      return
    }
    /**
     * Technicall, it's Omit<Element, 'children'> but `wrapNodes` actually
     * accepts that just fine so we override the type.
     */
    Transforms.wrapNodes(editor, nextElement as T, { at })
    Transforms.unwrapNodes(editor, { at: [...at, 0] })
    if(originalEntry[0].type!==nextElement.type&&(originalEntry[0].type==='ordered-list-item'||nextElement.type==='ordered-list-item')) {
      reflowFollowingLists(editor,at,nextElement.type==='ordered-list-item'?blockDepth(Editor.node(editor,at)[0]):blockDepth(originalEntry[0]))
    }
  })
}
