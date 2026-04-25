import { findDefinitionBindingAt } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { SourceRange } from '../types.js'

export interface GoToDefinitionResult {
  readonly name: string
  readonly range: SourceRange
}

export const goToDefinition: SemanticOperation<[pos: number], SourceRange | undefined> = (model, tree, document, pos) => {
  const binding = findDefinitionBindingAt(model, tree, document, pos)
  return binding?.range
}
