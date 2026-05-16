import type { Documentation } from '@language'
import { getDocumentation } from '@language'
import { findIdentifierAt } from '../model/query.js'
import type { SemanticOperation } from '../utilities/operations.js'
import type { SourceRange } from '../utilities/range.js'

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
