import { getStandardModule } from '@language'
import type { BaseModel, Binding, Identifier, IdentifierId, KnownValue, KnownValueModel, ReferenceModel } from '../model.js'
import { findImportAt } from '../query.js'

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
  if (identifier.kind === 'PropertyName') {
    return undefined
  }

  if (identifier.previousSibling == null) {
    // resolving "foo" in "foo.bar.baz" -> either a module or default-imported value
    return resolveKnownValueForIdentifier(baseModel, referenceModel, identifier)
  }

  if (identifier.previousSibling.previousSibling == null) {
    // resolving "bar" in "foo.bar.baz" -> could be an export of the module aliased as "foo"
    return resolveKnownValueWithMember(baseModel, referenceModel, identifier.previousSibling, identifier)
  }

  // resolving "baz" in "foo.bar.baz" -> not known (modules don't have nested members)
  return undefined
}

function resolveKnownValueForIdentifier (baseModel: BaseModel, referenceModel: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  const binding = referenceModel.identifierBindingMap.get(identifier.id)

  switch (binding?.kind) {
    case undefined:
      return resolveKnownValueForDefaultImport(baseModel, identifier)

    case 'use-alias': {
      const moduleName = findModuleNameForBinding(baseModel, binding)
      return moduleName != null ? { moduleName } : undefined
    }

    default:
      return undefined
  }
}

function resolveKnownValueWithMember (baseModel: BaseModel, referenceModel: ReferenceModel, object: Identifier, property: Identifier): KnownValue | undefined {
  const binding = referenceModel.identifierBindingMap.get(object.id)
  if (binding == null || binding.kind !== 'use-alias') {
    return undefined
  }

  const moduleName = findModuleNameForBinding(baseModel, binding)
  return moduleName != null ? { moduleName, exportName: property.name } : undefined
}

function resolveKnownValueForDefaultImport (baseModel: BaseModel, identifier: Identifier): KnownValue | undefined {
  for (const { alias, moduleName } of baseModel.imports) {
    // Must not have an alias (i.e. be a default import)
    if (alias == null && getStandardModule(moduleName)?.exports.has(identifier.name)) {
      return { moduleName, exportName: identifier.name }
    }
  }

  return undefined
}

function findModuleNameForBinding (model: BaseModel, binding: Binding): string | undefined {
  if (binding.kind !== 'use-alias') {
    return undefined
  }

  const importStatement = findImportAt(model, binding.range.offset)
  if (importStatement == null || importStatement.alias !== binding.name) {
    return undefined
  }

  return importStatement.moduleName
}
