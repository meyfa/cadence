import { findIdentifierAt } from '../model/query.js'
import type { SemanticOperation } from '../utilities/operations.js'
import type { SourceRange } from '../utilities/range.js'

export const findHighlightedOccurrences: SemanticOperation<[pos: number], readonly SourceRange[]> = (model, pos) => {
  const identifier = findIdentifierAt(model, pos)
  if (identifier == null) {
    return []
  }

  const binding = model.identifierBindingMap.get(identifier.id)
  if (binding == null) {
    return []
  }

  const references = model.referenceMap.get(binding.id) ?? []

  const ranges = references.map((reference) => reference.range)
  ranges.sort((a, b) => a.offset - b.offset || a.length - b.length)

  return ranges
}
