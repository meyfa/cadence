import type { Tree, TreeCursor } from '@lezer/common'
import type { TextLike } from '../../utilities/text.ts'
import { toSourceRange } from '../../utilities/text.ts'
import type { BaseModel } from '../model.ts'
import { BaseModelBuilder } from './builder.ts'
import type { WalkContext } from './context.ts'
import { walkChildren } from './context.ts'
import { NodeTypes } from './grammar.ts'
import { walkChainElement, walkIncompleteAssignment } from './nodes/access-chain.ts'
import { walkArgumentName } from './nodes/argument.ts'
import { isCompleteAssignment, walkAssignment } from './nodes/assignment.ts'
import { walkIfStatement } from './nodes/conditional.ts'
import { walkImport } from './nodes/import.ts'
import { walkBlock, walkCallable } from './nodes/scope.ts'

export function computeBaseModel (tree: Tree, document: TextLike): BaseModel {
  const builder = new BaseModelBuilder({
    node: tree.topNode.name,
    range: toSourceRange(document, 0, document.length)
  })

  const context: WalkContext = {
    builder,
    document,
    walk: (cursor, scopeId) => walk(context, cursor, scopeId)
  }

  context.walk(tree.cursor(), builder.rootScopeId)

  return builder.build()
}

function walk (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  switch (cursor.type.name) {
    case NodeTypes.AccessOrCall:
    case NodeTypes.Call:
    case NodeTypes.Callee:
    case NodeTypes.Member:
    case NodeTypes.VariableName:
      walkChainElement(context, cursor, scopeId, undefined)
      break

    case NodeTypes.Import:
      walkImport(context, cursor, scopeId)
      break

    case NodeTypes.Block:
      walkBlock(context, cursor, scopeId)
      break

    case NodeTypes.Function:
    case NodeTypes.Voice:
      walkCallable(context, cursor, scopeId)
      break

    case NodeTypes.IfStatement:
      walkIfStatement(context, cursor, scopeId)
      break

    case NodeTypes.Assignment:
      if (isCompleteAssignment(cursor.node)) {
        walkAssignment(context, cursor, scopeId)
      } else {
        walkIncompleteAssignment(context, cursor, scopeId)
      }
      break

    case NodeTypes.ArgumentName:
      walkArgumentName(context, cursor, scopeId)
      break

    default:
      walkChildren(context, cursor, scopeId)
  }
}
