import type { Binding, ReferenceModel } from '../model/model.js'
import type { LanguageDiagnostic } from '../utilities/diagnostic.js'
import type { SemanticOperation } from '../utilities/operations.js'
import { sameRange } from '../utilities/range.js'

export const findUnusedVariables: SemanticOperation<[], readonly LanguageDiagnostic[]> = (model) => {
  return model.bindings.filter((binding) => isUnused(binding, model)).map(toDiagnostic)
}

function isUnused (binding: Binding, model: ReferenceModel): boolean {
  // Buses and parts are implicitly used by the runtime.
  if (binding.kind !== 'assignment') {
    return false
  }

  const references = model.referenceMap.get(binding.id) ?? []

  // The binding itself counts as a reference, so check if there are any others.
  return references.every((reference) => sameRange(binding.range, reference.range))
}

function toDiagnostic (binding: Binding): LanguageDiagnostic {
  return {
    name: binding.name,
    message: `Unused variable "${binding.name}".`,
    range: binding.range
  }
}
