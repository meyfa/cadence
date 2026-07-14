import { getStandardModule } from '@meyfa/cadence-language'
import type { BaseModel, Binding, BindingId, Identifier, IdentifierId, Import, ImportId, ReferenceModel, Resolution } from '../model.ts'
import { findBindingAt } from '../query.ts'

export function computeReferenceModel (model: BaseModel): ReferenceModel {
  const resolutions = new Map<IdentifierId, Resolution>()
  const bindingReferences = new Map<BindingId, Identifier[]>()
  const importReferences = new Map<ImportId, Identifier[]>()

  const lookup = buildBindingLookup(model)

  for (const identifier of model.identifiers) {
    const binding = resolveDefinitionBinding(identifier, model, lookup)

    // If we have a binding, use that as the resolution.
    if (binding != null) {
      resolutions.set(identifier.id, { kind: 'binding', binding })
      addReference(bindingReferences, binding.id, identifier)
      continue
    }

    // Otherwise, for plain identifiers, we might have a reference to a default-imported symbol.
    if (identifier.kind === 'plain' && identifier.previousSibling == null) {
      const imp = resolveDefaultImport(lookup, identifier.name)
      if (imp != null) {
        resolutions.set(identifier.id, { kind: 'import', import: imp })
        addReference(importReferences, imp.id, identifier)
      }
    }
  }

  sortReferences(bindingReferences)
  sortReferences(importReferences)

  return { resolutions, bindingReferences, importReferences }
}

function addReference<Id> (map: Map<Id, Identifier[]>, id: Id, reference: Identifier): void {
  const references = map.get(id)
  if (references == null) {
    map.set(id, [reference])
    return
  }

  references.push(reference)
}

function sortReferences<Id> (map: Map<Id, Identifier[]>): void {
  for (const references of map.values()) {
    references.sort((a, b) => a.range.offset - b.range.offset)
  }
}

interface BindingLookup {
  readonly namedImports: ReadonlyMap<string, Binding>
  readonly defaultImports: ReadonlyMap<string, Import>
  readonly buses: ReadonlyMap<string, Binding>
  readonly effectsByBusName: ReadonlyMap<string, ReadonlyMap<string, Binding>>
  readonly byScopeAndName: ReadonlyMap<string, ReadonlyMap<string, Binding>>
  readonly parentScopes: ReadonlyMap<string, string>
}

function buildBindingLookup (model: BaseModel): BindingLookup {
  const namedImports = new Map<string, Binding>()
  const defaultImports = new Map<string, Import>()
  const buses = new Map<string, Binding>()
  const effectsByBusName = new Map<string, Map<string, Binding>>()
  const byScopeAndName = new Map<string, Map<string, Binding>>()

  const busNameByScopeId = new Map<string, string>()

  for (const binding of model.bindings) {
    switch (binding.kind) {
      case 'use-alias':
        if (!namedImports.has(binding.name)) {
          namedImports.set(binding.name, binding)
        }
        break

      case 'bus':
        if (!buses.has(binding.name)) {
          buses.set(binding.name, binding)

          if (binding.declaredScopeId != null) {
            busNameByScopeId.set(binding.declaredScopeId, binding.name)
          }
        }
        break

      case 'effect': {
        const busName = busNameByScopeId.get(binding.scopeId)
        if (busName != null) {
          let busEffects = effectsByBusName.get(busName)
          if (busEffects == null) {
            busEffects = new Map<string, Binding>()
            effectsByBusName.set(busName, busEffects)
          }

          if (!busEffects.has(binding.name)) {
            busEffects.set(binding.name, binding)
          }
        }
        break
      }

      default:
        break
    }

    let scopeMap = byScopeAndName.get(binding.scopeId)
    if (scopeMap == null) {
      scopeMap = new Map<string, Binding>()
      byScopeAndName.set(binding.scopeId, scopeMap)
    }

    if (binding.kind !== 'effect') {
      scopeMap.set(binding.name, binding)
    }
  }

  for (const imp of model.imports) {
    if (imp.alias == null && !defaultImports.has(imp.moduleName)) {
      defaultImports.set(imp.moduleName, imp)
    }
  }

  const parentScopes = new Map<string, string>()
  for (const scope of model.scopes) {
    if (scope.parentId != null) {
      parentScopes.set(scope.id, scope.parentId)
    }
  }

  return { namedImports, defaultImports, buses, effectsByBusName, byScopeAndName, parentScopes }
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
  if (isExplicitBusMemberReference(occurrence)) {
    const busIdentifier = occurrence.previousSibling
    if (busIdentifier == null) {
      return undefined
    }

    return lookup.effectsByBusName.get(busIdentifier.name)?.get(occurrence.name)
  }

  if (isExplicitBusReference(occurrence)) {
    return lookup.buses.get(occurrence.name)
  }

  if (occurrence.previousSibling != null) {
    return undefined
  }

  // Prefer alias imports over other types of bindings.
  const useAliasBinding = lookup.namedImports.get(occurrence.name)
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

function isExplicitBusMemberReference (identifier: Identifier): boolean {
  const objectIdentifier = identifier.previousSibling
  const namespaceIdentifier = objectIdentifier?.previousSibling

  return namespaceIdentifier?.name === 'bus' &&
    namespaceIdentifier.previousSibling == null
}

const importCache = new WeakMap<BindingLookup, Map<string, Import | undefined>>()

function resolveDefaultImport (lookup: BindingLookup, name: string): Import | undefined {
  const cache = importCache.get(lookup)

  if (cache?.has(name) === true) {
    return cache.get(name)
  }

  const imp = findDefaultImport(lookup, name)

  if (cache == null) {
    importCache.set(lookup, new Map([[name, imp]]))
  } else {
    cache.set(name, imp)
  }

  return imp
}

function findDefaultImport (lookup: BindingLookup, name: string): Import | undefined {
  for (const [moduleName, imp] of lookup.defaultImports) {
    if (getStandardModule(moduleName)?.exports.has(name) === true) {
      return imp
    }
  }

  return undefined
}
