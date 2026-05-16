import type { Binding, Identifier } from '../model/model.js'
import { findIdentifierAt, resolveDefinitionBinding } from '../model/query.js'
import type { SemanticOperation } from '../utilities/operations.js'

export interface GoToDefinitionResult {
  /**
   * The identifier at the original position that the definition was requested for.
   */
  readonly identifier: Identifier

  /**
   * The binding that the identifier resolves to.
   */
  readonly binding: Binding
}

export const goToDefinition: SemanticOperation<[pos: number], GoToDefinitionResult | undefined> = (model, pos) => {
  const identifier = findIdentifierAt(model, pos, 'inclusive')
  if (identifier == null) {
    return undefined
  }

  const binding = resolveDefinitionBinding(model, identifier)
  if (binding == null) {
    return undefined
  }

  return { identifier, binding }
}
