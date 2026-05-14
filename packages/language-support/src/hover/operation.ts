import type { HoverInfo } from '@language'
import { getStandardLibraryHoverInfo } from '@language'
import type { Binding, ImportStatement, Model } from '../analysis/model.js'
import { findAccessChainRootBefore, findDefinitionBindingAt, findIdentifierAt } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { SourceRange, TextLike } from '../types.js'

export interface HoverInfoWithRange extends HoverInfo {
  readonly range: SourceRange
}

export const getHoverInfo: SemanticOperation<[pos: number], HoverInfoWithRange | undefined> = (model, tree, document, pos) => {
  const occurrence = findIdentifierAt(model, pos, 'inclusive')
  if (occurrence == null) {
    return undefined
  }

  const memberInfo = resolveMemberHover(model, document, occurrence.range, occurrence.name)
  if (memberInfo != null) {
    return { ...memberInfo, range: occurrence.range }
  }

  const binding = findDefinitionBindingAt(model, document, pos)
  if (binding?.kind === 'use-alias') {
    const moduleName = findModuleNameForBinding(model.imports, binding)

    const info = moduleName == null ? undefined : getStandardLibraryHoverInfo(moduleName)
    if (info == null) {
      return undefined
    }

    return { ...info, range: occurrence.range }
  }

  if (binding != null) {
    return undefined
  }

  if (!isHoverableWildcardOccurrenceKind(occurrence.kind)) {
    return undefined
  }

  const moduleName = findWildcardModuleForExport(model.imports, occurrence.name)
  if (moduleName == null) {
    return undefined
  }

  const info = getStandardLibraryHoverInfo(moduleName, occurrence.name)
  if (info == null) {
    return undefined
  }

  return { ...info, range: occurrence.range }
}

function resolveMemberHover (
  model: Model,
  document: TextLike,
  range: SourceRange,
  memberName: string
): HoverInfo | undefined {
  const rootRange = findAccessChainRootBefore(document, range.offset)
  if (rootRange == null) {
    return undefined
  }

  const rootPosition = rootRange.offset + Math.min(rootRange.length - 1, 1)
  const rootBinding = findDefinitionBindingAt(model, document, rootPosition)
  if (rootBinding?.kind !== 'use-alias') {
    return undefined
  }

  const moduleName = findModuleNameForBinding(model.imports, rootBinding)
  if (moduleName == null) {
    return undefined
  }

  return getStandardLibraryHoverInfo(moduleName, memberName)
}

function findModuleNameForBinding (imports: readonly ImportStatement[], binding: Binding): string | undefined {
  return imports.find((statement) => statement.alias === binding.name)?.moduleName
}

function isHoverableWildcardOccurrenceKind (kind: string): boolean {
  return kind === 'VariableName' || kind === 'Callee'
}

function findWildcardModuleForExport (imports: readonly ImportStatement[], exportName: string): string | undefined {
  let resolvedModuleName: string | undefined

  for (const statement of imports) {
    if (statement.alias != null) {
      continue
    }

    if (getStandardLibraryHoverInfo(statement.moduleName, exportName) != null) {
      resolvedModuleName = statement.moduleName
    }
  }

  return resolvedModuleName
}
