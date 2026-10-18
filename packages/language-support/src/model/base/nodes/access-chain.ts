import type { TreeCursor } from '@lezer/common'
import { forEachChild } from '../../../utilities/tree.ts'
import type { Identifier } from '../../model.ts'
import { NodeTypes } from '../grammar.ts'
import type { WalkContext } from '../context.ts'
import { getVariableName } from './variables.ts'

/**
 * The parser falls back to 'Assignment' for incomplete syntax (e.g. a standalone 'fx.delay'),
 * so the children are treated as an access chain to still collect identifiers.
 */
export function walkIncompleteAssignment (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  let previous: Identifier | undefined

  forEachChild(cursor, () => {
    if (cursor.type.name === NodeTypes.VariableDefinition) {
      previous = walkPlainIdentifier(context, cursor, scopeId, undefined)
      return
    }

    const identifier = walkChainStep(context, cursor, scopeId, previous)
    if (identifier != null) {
      previous = identifier
    }
  })
}

/**
 * Handles every node type that can appear as an element in an access chain.
 */
export function walkChainElement (
  context: WalkContext,
  cursor: TreeCursor,
  scopeId: string,
  previous: Identifier | undefined
): Identifier | undefined {
  switch (cursor.type.name) {
    case NodeTypes.AccessOrCall:
      return walkAccessOrCall(context, cursor, scopeId, previous)

    case NodeTypes.Call:
      return walkCall(context, cursor, scopeId, previous)

    default:
      return walkPlainIdentifier(context, cursor, scopeId, previous)
  }
}

const chainElementTypes: ReadonlySet<string> = new Set([
  NodeTypes.AccessOrCall,
  NodeTypes.Call,
  NodeTypes.Callee,
  NodeTypes.Member,
  NodeTypes.VariableName
])

function walkChainStep (
  context: WalkContext,
  cursor: TreeCursor,
  scopeId: string,
  previous: Identifier | undefined
): Identifier | undefined {
  if (!chainElementTypes.has(cursor.type.name)) {
    context.walk(cursor, scopeId)
    return undefined
  }

  return walkChainElement(context, cursor, scopeId, previous)
}

function walkAccessOrCall (
  context: WalkContext,
  cursor: TreeCursor,
  scopeId: string,
  previous: Identifier | undefined
): Identifier | undefined {
  let current = previous
  let last: Identifier | undefined

  forEachChild(cursor, () => {
    const identifier = walkChainStep(context, cursor, scopeId, current)
    if (identifier != null) {
      current = identifier
      last = identifier
    }
  })

  return last
}

function walkCall (
  context: WalkContext,
  cursor: TreeCursor,
  scopeId: string,
  previous: Identifier | undefined
): Identifier | undefined {
  let callee: Identifier | undefined

  forEachChild(cursor, () => {
    if (cursor.type.name !== NodeTypes.Callee) {
      context.walk(cursor, scopeId)
      return
    }

    callee ??= walkChainElement(context, cursor, scopeId, previous)
  })

  return callee
}

function walkPlainIdentifier (
  context: WalkContext,
  cursor: TreeCursor,
  scopeId: string,
  previous: Identifier | undefined
): Identifier {
  const { name, range } = getVariableName(context.document, cursor.from, cursor.to)
  return context.builder.addIdentifier({ kind: 'plain', scopeId, name, range, previousSibling: previous })
}
