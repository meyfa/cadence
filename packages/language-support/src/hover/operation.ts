import type { Documentation } from '@language'
import { getDocumentation } from '@language'
import { findIdentifierAt } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { SourceRange } from '../types.js'

export interface HoverInfoWithRange extends Documentation {
  readonly range: SourceRange
}

export const getHoverInfo: SemanticOperation<[pos: number], HoverInfoWithRange | undefined> = (model, pos) => {
  const identifier = findIdentifierAt(model, pos, 'inclusive')
  if (identifier == null || identifier.kind === 'PropertyName') {
    return undefined
  }

  const knownValue = model.knownValues.get(identifier)
  if (knownValue != null) {
    const info = getDocumentation(knownValue.moduleName, knownValue.exportName)
    return info == null ? undefined : { ...info, range: identifier.range }
  }

  return undefined
}
