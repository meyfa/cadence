import { findUnusedAssignmentBindings } from '../analysis/query.js'
import type { SemanticOperation } from '../operations.js'
import type { LanguageDiagnostic } from '../types.js'

export const findUnusedVariables: SemanticOperation<[], readonly LanguageDiagnostic[]> = (model) => {
  return findUnusedAssignmentBindings(model).map((binding) => ({
    name: binding.name,
    message: `Unused variable "${binding.name}".`,
    range: binding.range
  }))
}
