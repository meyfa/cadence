import type { SourceRange } from '../utilities/range.js'
import { sameRange } from '../utilities/range.js'
import type { BaseModel, Binding, Identifier, ReferenceModel } from './model.js'

export function findIdentifierAt (model: BaseModel, position: number, boundary: 'strict' | 'inclusive' = 'strict'): Identifier | undefined {
  let low = 0
  let high = model.identifiers.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const identifier = model.identifiers[mid]

    if (position < identifier.range.offset) {
      high = mid - 1
    } else if (position >= identifier.range.offset + identifier.range.length) {
      low = mid + 1
    } else {
      return identifier
    }
  }

  if (boundary === 'inclusive') {
    const leftCandidate = model.identifiers.at(high)
    if (leftCandidate != null && leftCandidate.range.offset + leftCandidate.range.length === position) {
      return leftCandidate
    }

    const rightCandidate = model.identifiers.at(low)
    if (rightCandidate != null && rightCandidate.range.offset === position) {
      return rightCandidate
    }
  }

  return undefined
}

export function findDefinitionBindingAt (model: BaseModel & ReferenceModel, position: number): Binding | undefined {
  const occurrence = findIdentifierAt(model, position, 'inclusive')
  if (occurrence == null) {
    return undefined
  }

  return resolveDefinitionBinding(model, occurrence)
}

export type RangesByBinding = ReadonlyMap<string, readonly SourceRange[]>

export function findReferenceRangesAt (model: BaseModel & ReferenceModel, position: number): readonly SourceRange[] {
  const binding = findDefinitionBindingAt(model, position)
  return binding == null ? [] : getReferrenceRangesForBinding(model, binding)
}

export function buildReferenceRangesByBinding (model: BaseModel & ReferenceModel): RangesByBinding {
  return new Map(
    model.bindings.map((binding) => [binding.id, getReferrenceRangesForBinding(model, binding)])
  )
}

function getReferrenceRangesForBinding (model: ReferenceModel, binding: Binding): readonly SourceRange[] {
  const references = model.referenceMap.get(binding) ?? []

  const ranges = references.map((reference) => reference.range)
  ranges.sort((a, b) => a.offset - b.offset || a.length - b.length)

  return ranges
}

export function findUnusedAssignmentBindings (model: BaseModel & ReferenceModel): readonly Binding[] {
  return model.bindings.filter((binding) => {
    // Buses and parts are implicitly used by the runtime.
    if (binding.kind !== 'assignment') {
      return false
    }

    const references = model.referenceMap.get(binding) ?? []
    return references.every((reference) => sameRange(binding.range, reference.range))
  })
}

export function resolveDefinitionBinding (model: ReferenceModel, occurrence: Identifier): Binding | undefined {
  return model.identifierBindingMap.get(occurrence)
}
