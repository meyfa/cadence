import type { TreeCursor } from '@lezer/common'
import type { TextLike } from '../../utilities/text.ts'
import { forEachChild } from '../../utilities/tree.ts'
import type { BaseModelBuilder } from './builder.ts'

export interface WalkContext {
  readonly builder: BaseModelBuilder
  readonly document: TextLike

  /**
   * Dispatches the node under the cursor to its handler.
   * The cursor is restored to its original position after the handler returns.
   */
  readonly walk: (cursor: TreeCursor, scopeId: string) => void
}

export function walkChildren (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  forEachChild(cursor, () => {
    context.walk(cursor, scopeId)
  })
}
