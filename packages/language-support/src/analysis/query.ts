import type { SourceRange } from '../types.js'
import type { Binding, Identifier, Model } from './model.js'
import { sameRange } from './model.js'

export function findIdentifierAt (model: Model, position: number, boundary: 'strict' | 'inclusive' = 'strict'): Identifier | undefined {
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

export function findDefinitionBindingAt (model: Model, position: number): Binding | undefined {
  const occurrence = findIdentifierAt(model, position, 'inclusive')
  if (occurrence == null) {
    return undefined
  }

  return resolveDefinitionBinding(model, occurrence)
}

export type RangesByBinding = ReadonlyMap<string, readonly SourceRange[]>

export function findReferenceRangesAt (model: Model, position: number): readonly SourceRange[] {
  const binding = findDefinitionBindingAt(model, position)
  return binding == null ? [] : getReferrenceRangesForBinding(model, binding)
}

export function buildReferenceRangesByBinding (model: Model): RangesByBinding {
  return new Map(
    model.bindings.map((binding) => [binding.id, getReferrenceRangesForBinding(model, binding)])
  )
}

function getReferrenceRangesForBinding (model: Model, binding: Binding): readonly SourceRange[] {
  const references = model.referenceMap.get(binding) ?? []

  const ranges = references.map((reference) => reference.range)
  ranges.sort((a, b) => a.offset - b.offset || a.length - b.length)

  return ranges
}

export function findUnusedAssignmentBindings (model: Model): readonly Binding[] {
  return model.bindings.filter((binding) => {
    // Buses and parts are implicitly used by the runtime.
    if (binding.kind !== 'assignment') {
      return false
    }

    const references = model.referenceMap.get(binding) ?? []
    return references.every((reference) => sameRange(binding.range, reference.range))
  })
}

export function resolveDefinitionBinding (model: Model, occurrence: Identifier): Binding | undefined {
  return model.identifierBindingMap.get(occurrence)
}

export function computeAccessChain (member: Identifier): readonly Identifier[] {
  const identifiers: Identifier[] = []

  let current: Identifier | undefined = member
  while (current != null) {
    identifiers.push(current)
    current = current.previousSibling
  }

  // reverse to get chain in order from left to right (e.g. "foo.bar.baz" -> ["foo", "bar", "baz"])
  return identifiers.reverse()
}
