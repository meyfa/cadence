import type { Documentation } from '@language'
import { getDocumentation, getStandardModule } from '@language'
import type { Binding, Identifier, Model } from '../analysis/model.js'
import { computeAccessChain, findDefinitionBindingAt, findIdentifierAt, resolveDefinitionBinding, sameRange } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { SourceRange, TextLike } from '../types.js'

export interface HoverInfoWithRange extends Documentation {
  readonly range: SourceRange
}

export const getHoverInfo: SemanticOperation<[pos: number], HoverInfoWithRange | undefined> = (model, tree, document, pos) => {
  const identifier = findIdentifierAt(model, pos, 'inclusive')
  if (identifier == null || identifier.kind === 'PropertyName') {
    return undefined
  }

  const chain = computeAccessChain(model, document, identifier)

  switch (chain.length) {
    // hovering "foo" in "foo.bar.baz" -> show documentation for "foo" (module or default-imported value)
    case 1:
      return getHoverInfoForIdentifier(model, document, chain[0])

    // hovering "bar" in "foo.bar.baz" -> show documentation for "bar" export of module "foo" (if "foo" is a module alias)
    case 2:
      return getHoverInfoForMemberAccess(model, document, chain[0], chain[1])

    // hovering "baz" in "foo.bar.baz" -> no documentation (modules don't have nested members)
    default:
      return undefined
  }
}

function withRange (info: Documentation | undefined, range: SourceRange): HoverInfoWithRange | undefined {
  return info == null ? undefined : { ...info, range }
}

function getHoverInfoForIdentifier (model: Model, document: TextLike, identifier: Identifier): HoverInfoWithRange | undefined {
  const binding = findDefinitionBindingAt(model, document, identifier.range.offset)

  switch (binding?.kind) {
    case undefined:
      return getHoverInfoForDefaultImport(model, identifier)

    case 'use-alias': {
      const moduleName = findModuleNameForBinding(model, binding)
      return moduleName != null
        ? withRange(getDocumentation(moduleName), identifier.range)
        : undefined
    }

    default:
      return undefined
  }
}

function getHoverInfoForMemberAccess (model: Model, document: TextLike, object: Identifier, property: Identifier): HoverInfoWithRange | undefined {
  const binding = resolveDefinitionBinding(model, object, document)
  if (binding == null || binding.kind !== 'use-alias') {
    return undefined
  }

  const moduleName = findModuleNameForBinding(model, binding)
  return moduleName != null
    ? withRange(getDocumentation(moduleName, property.name), property.range)
    : undefined
}

function getHoverInfoForDefaultImport (model: Model, identifier: Identifier): HoverInfoWithRange | undefined {
  for (const { alias, moduleName } of model.imports) {
    if (alias != null) {
      continue // not a default import
    }

    if (getStandardModule(moduleName)?.exports.has(identifier.name)) {
      return withRange(getDocumentation(moduleName, identifier.name), identifier.range)
    }
  }

  return undefined
}

function findModuleNameForBinding (model: Model, binding: Binding): string | undefined {
  const module = model.imports.find((statement) => {
    return statement.aliasRange != null && sameRange(statement.aliasRange, binding.range)
  })

  return module?.moduleName
}
