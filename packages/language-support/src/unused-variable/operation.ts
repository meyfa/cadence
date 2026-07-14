import type { Binding, Import, Model, ReferenceModel } from '../model/model.ts'
import type { LanguageDiagnostic } from '../utilities/diagnostic.ts'
import type { SemanticOperation } from '../utilities/operations.ts'

export const findUnusedVariables: SemanticOperation<[], readonly LanguageDiagnostic[]> = (model) => {
  return [
    ...getUnusedVariables(model),
    ...getUnusedImports(model)
  ].sort((a, b) => a.range.offset - b.range.offset)
}

function getUnusedVariables (model: Model): readonly LanguageDiagnostic[] {
  return model.bindings
    .filter((binding) => isUnusedBinding(binding, model))
    .map((binding) => ({
      name: binding.name,
      message: `Unused ${binding.kind === 'use-alias' ? 'import' : 'variable'} "${binding.name}"`,
      range: binding.range
    }))
}

function getUnusedImports (model: Model): readonly LanguageDiagnostic[] {
  return model.imports
    .filter((statement) => isUnusedImport(statement, model))
    .map((statement) => ({
      name: statement.moduleName,
      message: `Unused import from "${statement.moduleName}"`,
      range: statement.aliasRange
    }))
}

function isUnusedBinding (binding: Binding, model: ReferenceModel): boolean {
  // Buses and parts are implicitly used by the runtime.
  if (binding.kind === 'bus' || binding.kind === 'part') {
    return false
  }

  const references = model.bindingReferences.get(binding.id)

  // At most one reference, which would be the definition itself.
  return references == null || references.length <= 1
}

function isUnusedImport (statement: Import, model: ReferenceModel): boolean {
  if (statement.alias != null) {
    // handled by binding references
    return false
  }

  const references = model.importReferences.get(statement.id)
  return references == null || references.length === 0
}
