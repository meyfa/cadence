import { findIdentifierAt } from '../model/query.js'
import type { SemanticOperation } from '../utilities/operations.js'
import type { SourceRange } from '../utilities/range.js'

export const findHighlightedOccurrences: SemanticOperation<[pos: number], readonly SourceRange[]> = (model, pos) => {
  const identifier = findIdentifierAt(model, pos)
  if (identifier == null) {
    return []
  }

  const resolution = model.resolutions.get(identifier.id)
  if (resolution == null) {
    return []
  }

  switch (resolution.kind) {
    // Resolves directly to a binding (an identifier that is declared in the same file).
    case 'binding':
      return model.bindingReferences.get(resolution.binding.id)
        ?.map(({ range }) => range) ?? []

    // Resolves to an exported member of a default-imported module.
    // References to other members of the same module must be filtered out.
    case 'import':
      return model.importReferences.get(resolution.import.id)
        ?.filter((ref) => ref.name === identifier.name)
        .map(({ range }) => range) ?? []
  }
}
