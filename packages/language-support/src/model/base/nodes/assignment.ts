import type { SyntaxNode, TreeCursor } from '@lezer/common'
import { forEachChild } from '../../../utilities/tree.ts'
import type { WalkContext } from '../context.ts'
import { NodeTypes, Tokens } from '../grammar.ts'
import type { VariableName } from './variables.ts'
import { getVariableName } from './variables.ts'

/**
 * Whether the assignment has an '=', as opposed to being the parser's fallback for incomplete syntax.
 */
export function isCompleteAssignment (node: SyntaxNode): boolean {
  return node.getChild(Tokens.Equal) != null
}

export function walkAssignment (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  let variable: VariableName | undefined
  let isExposed = false

  forEachChild(cursor, () => {
    switch (cursor.type.name) {
      // The variable is bound below, once the right-hand side has been walked.
      case NodeTypes.VariableDefinition:
        variable = getVariableName(context.document, cursor.from, cursor.to)
        break

      case Tokens.Exposure:
        isExposed = true
        break

      default:
        context.walk(cursor, scopeId)
        break
    }
  })

  if (variable == null) {
    return
  }

  context.builder.addBinding({
    kind: 'regular',
    scopeId,
    name: variable.name,
    range: variable.range,
    isExposed,

    // The binding cannot be referred to from the assignment's right-hand side.
    visibilityStartOffset: cursor.to
  })
}
