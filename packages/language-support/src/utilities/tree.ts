import type { SyntaxNode, TreeCursor } from '@lezer/common'

export type TreeCallback = (cursor: TreeCursor) => void

export function forEachChildNode (node: SyntaxNode, callback: TreeCallback): void {
  const cursor = node.cursor()

  if (cursor.firstChild()) {
    do {
      callback(cursor)
    } while (cursor.nextSibling())
  }
}
