import type { SyntaxNode } from '@lezer/common'
import type { TextLike } from '../../../utilities/text.ts'
import { forEachChildNode } from '../../../utilities/tree.ts'
import type { Binding } from '../../model.ts'
import type { BaseModelBuilder } from '../builder.ts'
import type { VariableName } from './variables.ts'
import { getVariableName } from './variables.ts'

export interface WalkAssignmentResult {
  readonly hasEquals: boolean
  readonly isExposed: boolean
  readonly binding?: Omit<Binding, 'id'>
}

export function walkAssignment (
  builder: BaseModelBuilder,
  document: TextLike,
  node: SyntaxNode,
  scopeId: string
): WalkAssignmentResult {
  const { hasEquals, isExposed, variable } = parseAssignment(document, node)

  let binding: Omit<Binding, 'id'> | undefined

  if (hasEquals && variable != null) {
    binding = {
      kind: 'regular',
      scopeId,
      name: variable.name,
      range: variable.range,
      isExposed,

      // The binding cannot be referred to from the assignment's right-hand side.
      visibilityStartOffset: node.to
    }
  }

  return { hasEquals, isExposed, binding }
}

interface AssignmentParseResult {
  readonly hasEquals: boolean
  readonly isExposed: boolean
  readonly variable?: VariableName
}

function parseAssignment (document: TextLike, node: SyntaxNode): AssignmentParseResult {
  let hasEquals = false
  let isExposed = false
  let variable: VariableName | undefined

  forEachChildNode(node, (cursor) => {
    switch (cursor.type.name) {
      case 'VariableDefinition':
        variable = getVariableName(document, cursor.from, cursor.to)
        break
      case '=':
        hasEquals = true
        break
      case '@':
        isExposed = true
        break
    }
  })

  return { hasEquals, isExposed, variable }
}
