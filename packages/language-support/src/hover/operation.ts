import type { Documentation } from '@meyfa/cadence-language'
import { getGlobalDocumentation, getModuleDocumentation } from '@meyfa/cadence-language'
import { findIdentifierAt } from '../model/query.ts'
import type { SemanticOperation } from '../utilities/operations.ts'
import type { SourceRange } from '../utilities/range.ts'

export interface HoverInfoWithRange extends Documentation {
  readonly range: SourceRange
}

export const getHoverInfo: SemanticOperation<[pos: number], HoverInfoWithRange | undefined> = (model, pos) => {
  const identifier = findIdentifierAt(model, pos)
  if (identifier == null || identifier.kind === 'argument-name') {
    return undefined
  }

  const knownValue = model.knownValues.get(identifier.id)

  const info = (() => {
    if (knownValue == null) {
      return undefined
    }

    switch (knownValue.type) {
      case 'global':
        return getGlobalDocumentation(knownValue.name)
      case 'module':
        return getModuleDocumentation(knownValue.moduleName)
      case 'module_value':
        return getModuleDocumentation(knownValue.moduleName, knownValue.exportName)
    }
  })()

  return info == null ? undefined : { ...info, range: identifier.range }
}
