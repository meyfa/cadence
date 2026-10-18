import type { SyntaxNode, TreeCursor } from '@lezer/common'

export type TreeCallback = (cursor: TreeCursor) => void

/**
 * Invokes the callback for each direct child of the cursor's current node.
 * The cursor is restored to its original position after iteration.
 */
export function forEachChild (cursor: TreeCursor, callback: TreeCallback): void {
  if (!cursor.firstChild()) {
    return
  }

  do {
    callback(cursor)
  } while (cursor.nextSibling())

  cursor.parent()
}

/**
 * Invokes the callback for each direct child of the given node.
 */
export function forEachChildNode (node: SyntaxNode, callback: TreeCallback): void {
  forEachChild(node.cursor(), callback)
}
