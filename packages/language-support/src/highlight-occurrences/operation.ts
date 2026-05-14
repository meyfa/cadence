import { findReferenceRangesAt } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { SourceRange } from '../types.js'

export const findHighlightedOccurrences: SemanticOperation<[pos: number], readonly SourceRange[]> = (model, pos) => {
  return findReferenceRangesAt(model, pos)
}
