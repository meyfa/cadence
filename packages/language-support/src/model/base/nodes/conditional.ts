import type { TreeCursor } from '@lezer/common'
import { forEachChild } from '../../../utilities/tree.ts'
import { NodeTypes } from '../grammar.ts'
import type { WalkContext } from '../context.ts'
import { walkBlock } from './scope.ts'

export function walkIfStatement (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  const branchScopeIds = new Set<string>()

  forEachChild(cursor, () => {
    if (cursor.type.name === NodeTypes.Block) {
      const branchScope = walkBlock(context, cursor, scopeId)
      branchScopeIds.add(branchScope.id)
      return
    }

    context.walk(cursor, scopeId)
  })

  context.builder.addConditionalBinding(scopeId, branchScopeIds, cursor.to)
}
