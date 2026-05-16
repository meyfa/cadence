import { findUnusedAssignmentBindings } from '../model/query.js'
import type { SemanticOperation } from '../utilities/operations.js'
import type { LanguageDiagnostic } from '../utilities/diagnostic.js'

export const findUnusedVariables: SemanticOperation<[], readonly LanguageDiagnostic[]> = (model) => {
  return findUnusedAssignmentBindings(model).map((binding) => ({
    name: binding.name,
    message: `Unused variable "${binding.name}".`,
    range: binding.range
  }))
}
