import type { BaseModel, Identifier, IdentifierId, KnownValue, KnownValueModel, ReferenceModel } from '../model.ts'

export function computeKnownValueModel (baseModel: BaseModel, referenceModel: ReferenceModel): KnownValueModel {
  const knownValues = new Map<IdentifierId, KnownValue>()

  for (const identifier of baseModel.identifiers) {
    const value = resolve(referenceModel, identifier)
    if (value != null) {
      knownValues.set(identifier.id, value)
    }
  }

  return { knownValues }
}

function resolve (model: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  return identifier.previousSibling != null
    ? resolveForMemberAccess(model, identifier.previousSibling, identifier.name)
    : resolveForIdentifier(model, identifier)
}

function resolveForMemberAccess (model: ReferenceModel, object: Identifier, property: string): KnownValue | undefined {
  const objectValue = resolveForIdentifier(model, object)
  if (objectValue?.moduleName != null) {
    return { moduleName: objectValue.moduleName, exportName: property }
  }

  return undefined
}

function resolveForIdentifier (model: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  const resolution = model.resolutions.get(identifier.id)

  switch (resolution?.kind) {
    case 'import':
      return { moduleName: resolution.import.moduleName, exportName: identifier.name }

    case 'binding':
      if (resolution.binding.moduleName != null) {
        return { moduleName: resolution.binding.moduleName }
      }
      break

    default:
      return undefined
  }
}
