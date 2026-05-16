import { findReferenceRangesAt } from '../model/query.js'
import type { SemanticOperation } from '../utilities/operations.js'
import type { SourceRange } from '../utilities/range.js'

export const findHighlightedOccurrences: SemanticOperation<[pos: number], readonly SourceRange[]> = (model, pos) => {
  return findReferenceRangesAt(model, pos)
}
