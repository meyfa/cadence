import type { BaseModel, Binding, Identifier, ReferenceModel } from '../model.js'
import { findBindingAt } from '../query.js'

export function computeReferenceModel (model: BaseModel): ReferenceModel {
  const identifierBindingMap = new Map<Identifier, Binding>()
  const referenceMap = new Map<Binding, Identifier[]>()

  for (const identifier of model.identifiers) {
    const binding = resolveDefinitionBinding(model, identifier)
    if (binding == null) {
      continue
    }

    identifierBindingMap.set(identifier, binding)

    const references = referenceMap.get(binding)
    if (references == null) {
      referenceMap.set(binding, [identifier])
      continue
    }

    references.push(identifier)
  }

  return { identifierBindingMap, referenceMap }
}

function resolveDefinitionBinding (model: BaseModel, occurrence: Identifier): Binding | undefined {
  switch (occurrence.kind) {
    case 'PropertyName':
      return undefined

    // Ensure that definitions resolve to themselves
    case 'VariableDefinition':
    case 'UseAlias':
      return findBindingAt(model, occurrence.range.offset)

    case 'VariableName':
    case 'Callee':
    case 'MemberAccess':
      return findRegularBinding(model, occurrence)

    default:
      occurrence.kind satisfies never
  }
}

function findRegularBinding (model: BaseModel, occurrence: Identifier): Binding | undefined {
  if (isExplicitBusReference(occurrence)) {
    return findExplicitBusBinding(model, occurrence.name)
  }

  if (occurrence.previousSibling != null) {
    return undefined
  }

  if (model.imports.some((statement) => statement.alias === occurrence.name)) {
    return model.bindingsByName.get(occurrence.name)?.find((binding) => binding.kind === 'use-alias')
  }

  let scopeId: string | undefined = occurrence.scopeId

  while (scopeId != null) {
    const scoped = model.bindingsByScope.get(scopeId) ?? []

    const binding = scoped.find((binding) => binding.name === occurrence.name)
    if (binding != null) {
      return binding
    }

    const scope = model.scopes.get(scopeId)
    scopeId = scope?.parentId
  }

  return undefined
}

function isExplicitBusReference (identifier: Identifier): boolean {
  return identifier.previousSibling != null &&
    identifier.previousSibling.name === 'bus' &&
    identifier.previousSibling.previousSibling == null
}

function findExplicitBusBinding (model: BaseModel, busName: string): Binding | undefined {
  const busBindings = model.bindingsByName.get(busName) ?? []
  return busBindings.find((binding) => binding.kind === 'bus')
}
