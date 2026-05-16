import { getStandardModule } from '@language'
import type { BaseModel, Identifier, IdentifierId, KnownValue, KnownValueModel, ReferenceModel } from '../model.js'

export function computeKnownValueModel (baseModel: BaseModel, referenceModel: ReferenceModel): KnownValueModel {
  const knownValues = new Map<IdentifierId, KnownValue>()

  for (const identifier of baseModel.identifiers) {
    const value = resolveKnownValue(baseModel, referenceModel, identifier)
    if (value != null) {
      knownValues.set(identifier.id, value)
    }
  }

  return { knownValues }
}

function resolveKnownValue (baseModel: BaseModel, referenceModel: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  if (identifier.kind === 'property-name') {
    return undefined
  }

  if (identifier.previousSibling == null) {
    // resolving "foo" in "foo.bar.baz" -> either a module or default-imported value
    return resolveKnownValueForIdentifier(baseModel, referenceModel, identifier)
  }

  if (identifier.previousSibling.previousSibling == null) {
    // resolving "bar" in "foo.bar.baz" -> could be an export of the module aliased as "foo"
    return resolveKnownValueWithMember(referenceModel, identifier.previousSibling, identifier)
  }

  // resolving "baz" in "foo.bar.baz" -> not known (modules don't have nested members)
  return undefined
}

function resolveKnownValueForIdentifier (baseModel: BaseModel, referenceModel: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  const binding = referenceModel.identifierBindingMap.get(identifier.id)

  switch (binding?.kind) {
    case undefined:
      return resolveKnownValueForDefaultImport(baseModel, identifier.name)

    case 'use-alias':
      return binding.moduleName != null ? { moduleName: binding.moduleName } : undefined

    default:
      return undefined
  }
}

function resolveKnownValueWithMember (referenceModel: ReferenceModel, object: Identifier, property: Identifier): KnownValue | undefined {
  const binding = referenceModel.identifierBindingMap.get(object.id)
  if (binding == null || binding.kind !== 'use-alias' || binding.moduleName == null) {
    return undefined
  }

  return { moduleName: binding.moduleName, exportName: property.name }
}

function resolveKnownValueForDefaultImport (baseModel: BaseModel, name: string): KnownValue | undefined {
  for (const { alias, moduleName } of baseModel.imports) {
    // Must not have an alias (i.e. be a default import)
    if (alias == null && getStandardModule(moduleName)?.exports.has(name)) {
      return { moduleName, exportName: name }
    }
  }

  return undefined
}
