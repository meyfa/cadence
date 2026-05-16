import type { Binding, ReferenceModel } from '../model/model.js'
import type { LanguageDiagnostic } from '../utilities/diagnostic.js'
import type { SemanticOperation } from '../utilities/operations.js'

export const findUnusedVariables: SemanticOperation<[], readonly LanguageDiagnostic[]> = (model) => {
  return model.bindings.filter((binding) => isUnused(binding, model)).map(toDiagnostic)
}

function isUnused (binding: Binding, model: ReferenceModel): boolean {
  // Buses and parts are implicitly used by the runtime.
  if (binding.kind === 'bus' || binding.kind === 'part') {
    return false
  }

  const references = model.referenceMap.get(binding.id)

  // At most one reference, which would be the definition itself.
  return references == null || references.length <= 1
}

function toDiagnostic (binding: Binding): LanguageDiagnostic {
  const type = binding.kind === 'use-alias' ? 'import' : 'variable'

  return {
    name: binding.name,
    message: `Unused ${type} "${binding.name}"`,
    range: binding.range
  }
}
