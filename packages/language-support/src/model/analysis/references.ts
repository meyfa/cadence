import type { BaseModel, Binding, BindingId, Identifier, IdentifierId, ReferenceModel } from '../model.js'
import { findBindingAt } from '../query.js'

export function computeReferenceModel (model: BaseModel): ReferenceModel {
  const lookup = buildBindingLookup(model)

  const identifierBindingMap = new Map<IdentifierId, Binding>()
  const referenceMap = new Map<BindingId, Identifier[]>()

  for (const identifier of model.identifiers) {
    const binding = resolveDefinitionBinding(identifier, model, lookup)
    if (binding == null) {
      continue
    }

    identifierBindingMap.set(identifier.id, binding)

    const references = referenceMap.get(binding.id)
    if (references == null) {
      referenceMap.set(binding.id, [identifier])
      continue
    }

    references.push(identifier)
  }

  for (const references of referenceMap.values()) {
    references.sort((a, b) => a.range.offset - b.range.offset)
  }

  return { identifierBindingMap, referenceMap }
}

interface BindingLookup {
  readonly useAliases: ReadonlyMap<string, Binding>
  readonly buses: ReadonlyMap<string, Binding>
  readonly byScopeAndName: ReadonlyMap<string, ReadonlyMap<string, Binding>>
  readonly parentScopes: ReadonlyMap<string, string>
}

function buildBindingLookup (model: BaseModel): BindingLookup {
  const useAliases = new Map<string, Binding>()
  const buses = new Map<string, Binding>()
  const byScopeAndName = new Map<string, Map<string, Binding>>()

  for (const binding of model.bindings) {
    switch (binding.kind) {
      case 'use-alias':
        if (!useAliases.has(binding.name)) {
          useAliases.set(binding.name, binding)
        }
        break

      case 'bus':
        if (!buses.has(binding.name)) {
          buses.set(binding.name, binding)
        }
        break

      default:
        break
    }

    let scopeMap = byScopeAndName.get(binding.scopeId)
    if (scopeMap == null) {
      scopeMap = new Map<string, Binding>()
      byScopeAndName.set(binding.scopeId, scopeMap)
    }

    scopeMap.set(binding.name, binding)
  }

  const parentScopes = new Map<string, string>()
  for (const scope of model.scopes) {
    if (scope.parentId != null) {
      parentScopes.set(scope.id, scope.parentId)
    }
  }

  return { useAliases, buses, byScopeAndName, parentScopes }
}

function resolveDefinitionBinding (occurrence: Identifier, model: BaseModel, lookup: BindingLookup): Binding | undefined {
  switch (occurrence.kind) {
    case 'plain':
      return findRegularBinding(occurrence, lookup)

    case 'definition':
      return findBindingAt(model, occurrence.range.offset)

    case 'property-name':
      return undefined

    default:
      occurrence.kind satisfies never
  }
}

function findRegularBinding (occurrence: Identifier, lookup: BindingLookup): Binding | undefined {
  if (isExplicitBusReference(occurrence)) {
    return lookup.buses.get(occurrence.name)
  }

  if (occurrence.previousSibling != null) {
    return undefined
  }

  // Prefer alias imports over other types of bindings.
  const useAliasBinding = lookup.useAliases.get(occurrence.name)
  if (useAliasBinding != null) {
    return useAliasBinding
  }

  let scopeId: string | undefined = occurrence.scopeId

  while (scopeId != null) {
    const binding = lookup.byScopeAndName.get(scopeId)?.get(occurrence.name)
    if (binding != null) {
      return binding
    }

    scopeId = lookup.parentScopes.get(scopeId)
  }

  return undefined
}

function isExplicitBusReference (identifier: Identifier): boolean {
  return identifier.previousSibling != null &&
    identifier.previousSibling.name === 'bus' &&
    identifier.previousSibling.previousSibling == null
}
