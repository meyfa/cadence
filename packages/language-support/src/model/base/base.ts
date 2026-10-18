import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { TextLike } from '../../utilities/text.ts'
import { toSourceRange } from '../../utilities/text.ts'
import type { BaseModel, Binding, Identifier } from '../model.ts'
import { BaseModelBuilder } from './builder.ts'
import { scopeKey } from './keys.ts'
import { walkAssignment } from './nodes/assignment.ts'
import { walkImport } from './nodes/import.ts'
import { getVariableName } from './nodes/variables.ts'

export function computeBaseModel (tree: Tree, document: TextLike): BaseModel {
  const builder = new BaseModelBuilder({
    node: tree.topNode.name,
    range: toSourceRange(document, 0, document.length)
  })

  walk({
    builder,
    document,
    cursor: tree.cursor(),
    scopeId: builder.rootScopeId,
    assignmentHasEquals: false,
    assignmentIsExposed: false
  })

  return builder.build()
}

interface WalkContext {
  readonly builder: BaseModelBuilder
  readonly document: TextLike
  readonly cursor: TreeCursor
  readonly parentType?: string
  readonly scopeId: string
  readonly assignmentHasEquals: boolean
  readonly assignmentIsExposed: boolean
  readonly previousSibling?: Identifier
}

function walk ({
  builder,
  document,
  cursor,
  parentType,
  scopeId,
  assignmentHasEquals,
  assignmentIsExposed,
  previousSibling
}: WalkContext): Identifier | undefined {
  const typeName = cursor.type.name
  const from = cursor.from
  const to = cursor.to

  const range = toSourceRange(document, from, to)

  const nextParentType = typeName

  let nextScopeId = scopeId
  let nextAssignmentHasEquals = assignmentHasEquals
  let nextAssignmentIsExposed = assignmentIsExposed
  let accessChainTail: Identifier | undefined
  let deferredBinding: Omit<Binding, 'id'> | undefined
  let conditionalBranchScopeIds: string[] | undefined

  switch (typeName) {
    case 'Import': {
      walkImport(builder, document, cursor.node, scopeId)
      break
    }

    case 'Block':
    case 'Function':
    case 'Voice': {
      const scope = builder.addScope({ node: typeName, range, parentId: scopeId })
      nextScopeId = scope.id
      break
    }

    case 'IfStatement': {
      conditionalBranchScopeIds = cursor.node.getChildren('Block')
        .map((block) => scopeKey('Block', toSourceRange(document, block.from, block.to)))
      break
    }

    case 'Assignment': {
      const { hasEquals, isExposed, binding } = walkAssignment(builder, document, cursor.node, scopeId)
      deferredBinding = binding
      nextAssignmentHasEquals = hasEquals
      nextAssignmentIsExposed = isExposed
      break
    }

    case 'VariableDefinition': {
      const { name, range: nameRange } = getVariableName(document, from, to)

      switch (parentType) {
        case 'Assignment': {
          if (assignmentHasEquals) {
            // Handled via deferredBinding in the Assignment case above.
            break
          }
          // Invalid/incomplete syntax encountered.
          // We still add an identifier as a best-effort approach to provide some level of functionality.
          accessChainTail = builder.addIdentifier({ kind: 'plain', scopeId, name, range: nameRange, previousSibling })
          break
        }

        case 'Function':
        case 'Voice': {
          builder.addBinding({ kind: 'regular', scopeId, name, range: nameRange })
          break
        }
      }
      break
    }

    case 'ArgumentName': {
      const name = document.sliceString(from, to)
      builder.addIdentifier({ kind: 'argument', scopeId, name, range })
      break
    }

    case 'VariableName':
    case 'Callee':
    case 'Member': {
      const { name, range: nameRange } = getVariableName(document, from, to)
      accessChainTail = builder.addIdentifier({ kind: 'plain', scopeId, name, range: nameRange, previousSibling })
      break
    }
  }

  // The parser defaults to 'Assignment' for incomplete syntax (e.g. standalone 'fx.delay'),
  // so we use heuristics to still collect identifiers in that case.
  const trackAccessChain = typeName === 'AccessOrCall' || (typeName === 'Assignment' && !nextAssignmentHasEquals)

  let nextPreviousSibling = previousSibling

  if (cursor.firstChild()) {
    do {
      const childTypeName = cursor.type.name

      const childPreviousSibling = (() => {
        if (typeName === 'Call') {
          return childTypeName === 'Callee' ? previousSibling : undefined
        }

        return trackAccessChain && shouldKeepPreviousSibling(cursor.node)
          ? nextPreviousSibling
          : undefined
      })()

      const childAccessChainTail = walk({
        builder,
        document,
        cursor,
        parentType: nextParentType,
        scopeId: nextScopeId,
        assignmentHasEquals: nextAssignmentHasEquals,
        assignmentIsExposed: nextAssignmentIsExposed,
        previousSibling: childPreviousSibling
      })

      if (typeName === 'Call') {
        accessChainTail ??= childAccessChainTail
        continue
      }

      if (trackAccessChain && childAccessChainTail != null) {
        nextPreviousSibling = childAccessChainTail
        accessChainTail = childAccessChainTail
      }
    } while (cursor.nextSibling())
    cursor.parent()
  }

  if (deferredBinding != null) {
    builder.addBinding(deferredBinding)
  }

  if (typeName === 'IfStatement' && conditionalBranchScopeIds != null) {
    builder.addConditionalBinding(scopeId, conditionalBranchScopeIds, to)
  }

  return accessChainTail
}

function shouldKeepPreviousSibling (node: SyntaxNode): boolean {
  const type = node.type.name

  return type === 'AccessOrCall' ||
    type === 'Callee' ||
    type === 'Call' ||
    type === 'Member' ||
    type === 'VariableName'
}
