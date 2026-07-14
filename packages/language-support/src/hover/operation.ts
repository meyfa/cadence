import type { Documentation } from '@meyfa/cadence-language'
import { getDocumentation } from '@meyfa/cadence-language'
import { findIdentifierAt } from '../model/query.ts'
import type { SemanticOperation } from '../utilities/operations.ts'
import type { SourceRange } from '../utilities/range.ts'

export interface HoverInfoWithRange extends Documentation {
  readonly range: SourceRange
}

export const getHoverInfo: SemanticOperation<[pos: number], HoverInfoWithRange | undefined> = (model, pos) => {
  const identifier = findIdentifierAt(model, pos)
  if (identifier == null || identifier.kind === 'property-name') {
    return undefined
  }

  const knownValue = model.knownValues.get(identifier.id)
  if (knownValue != null) {
    const info = getDocumentation(knownValue.moduleName, knownValue.exportName)
    return info == null ? undefined : { ...info, range: identifier.range }
  }

  return undefined
}
