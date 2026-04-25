import { findUnusedAssignmentBindings } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { LanguageDiagnostic } from '../types.js'

export const findUnusedVariables: SemanticOperation<[], readonly LanguageDiagnostic[]> = (model, tree, document) => {
  return findUnusedAssignmentBindings(model, tree, document).map((binding) => ({
    name: binding.name,
    message: `Unused variable "${binding.name}".`,
    range: binding.range
  }))
}
