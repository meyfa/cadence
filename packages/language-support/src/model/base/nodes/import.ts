import type { SyntaxNode } from '@lezer/common'
import { parseStringLiteral } from '@meyfa/cadence-language'
import type { SourceRange } from '../../../utilities/range.ts'
import type { TextLike } from '../../../utilities/text.ts'
import { toSourceRange } from '../../../utilities/text.ts'
import { forEachChildNode } from '../../../utilities/tree.ts'
import type { Import } from '../../model.ts'
import type { BaseModelBuilder } from '../builder.ts'

export function walkImport (
  builder: BaseModelBuilder,
  document: TextLike,
  node: SyntaxNode,
  scopeId: string
): void {
  const statement = parseImport(document, node)
  if (statement == null) {
    return
  }

  const { alias, aliasRange, moduleName } = statement
  if (alias != null) {
    builder.addBinding({ kind: 'use-alias', scopeId, name: alias, range: aliasRange, moduleName })
  }

  builder.addImport(statement)
}

function parseImport (document: TextLike, node: SyntaxNode): Omit<Import, 'id'> | undefined {
  let moduleName: string | undefined
  let alias: string | undefined
  let aliasRange: SourceRange | undefined

  forEachChildNode(node, (cursor) => {
    switch (cursor.type.name) {
      case 'String':
        moduleName ??= parseStringLiteral(document.sliceString(cursor.from, cursor.to))
        break
      case 'UseAlias':
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
  if (alias === '*') {
    return result
  }

  return { ...result, alias }
}
