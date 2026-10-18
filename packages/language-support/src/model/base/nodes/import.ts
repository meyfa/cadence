import type { SyntaxNode, TreeCursor } from '@lezer/common'
import { parseStringLiteral } from '@meyfa/cadence-language'
import type { SourceRange } from '../../../utilities/range.ts'
import type { TextLike } from '../../../utilities/text.ts'
import { toSourceRange } from '../../../utilities/text.ts'
import { forEachChildNode } from '../../../utilities/tree.ts'
import type { Import } from '../../model.ts'
import type { WalkContext } from '../context.ts'
import { walkChildren } from '../context.ts'
import { NodeTypes, Tokens } from '../grammar.ts'

export function walkImport (context: WalkContext, cursor: TreeCursor, scopeId: string): void {
  const statement = parseImport(context.document, cursor.node)

  if (statement != null) {
    const { alias, aliasRange, moduleName } = statement
    if (alias != null) {
      context.builder.addBinding({ kind: 'use-alias', scopeId, name: alias, range: aliasRange, moduleName })
    }

    context.builder.addImport(statement)
  }

  // The module name is a string, which could contain interpolated expressions.
  walkChildren(context, cursor, scopeId)
}

function parseImport (document: TextLike, node: SyntaxNode): Omit<Import, 'id'> | undefined {
  let moduleName: string | undefined
  let alias: string | undefined
  let aliasRange: SourceRange | undefined

  forEachChildNode(node, (cursor) => {
    switch (cursor.type.name) {
      case NodeTypes.String:
        moduleName ??= parseStringLiteral(document.sliceString(cursor.from, cursor.to))
        break
      case NodeTypes.UseAlias:
        alias ??= document.sliceString(cursor.from, cursor.to)
        aliasRange ??= toSourceRange(document, cursor.from, cursor.to)
        break
    }
  })

  if (moduleName == null || alias == null || aliasRange == null) {
    return undefined
  }

  const range = toSourceRange(document, node.from, node.to)

  const result = { moduleName, range, aliasRange }
  if (alias === Tokens.DefaultImport) {
    return result
  }

  return { ...result, alias }
}
