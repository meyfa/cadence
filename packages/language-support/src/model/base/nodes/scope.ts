import type { TreeCursor } from '@lezer/common'
import { toSourceRange } from '../../../utilities/text.ts'
import { forEachChild } from '../../../utilities/tree.ts'
import type { Scope } from '../../model.ts'
import type { WalkContext } from '../context.ts'
import { walkChildren } from '../context.ts'
import { NodeTypes } from '../grammar.ts'
import { getVariableName } from './variables.ts'

export function walkBlock (context: WalkContext, cursor: TreeCursor, scopeId: string): Scope {
  const scope = enterScope(context, cursor, scopeId)
  walkChildren(context, cursor, scope.id)
  return scope
}

/**
 * Handles 'Function' and 'Voice', whose parameters or name are bound inside the scope they introduce.
 */
export function walkCallable (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  const scope = enterScope(context, cursor, scopeId)

  forEachChild(cursor, () => {
    if (cursor.type.name !== NodeTypes.VariableDefinition) {
      context.walk(cursor, scope.id)
      return
    }

    const { name, range } = getVariableName(context.document, cursor.from, cursor.to)
    context.builder.addBinding({ kind: 'regular', scopeId: scope.id, name, range })
  })
}

function enterScope (context: WalkContext, cursor: TreeCursor, parentId: string): Scope {
  return context.builder.addScope({
    node: cursor.type.name,
    range: toSourceRange(context.document, cursor.from, cursor.to),
    parentId
  })
}
