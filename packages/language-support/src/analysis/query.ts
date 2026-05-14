import type { SourceRange } from '../types.js'
import type { Binding, BindingKind, Identifier, Model } from './model.js'

const GLOBAL_BINDING_PRIORITY: readonly BindingKind[] = ['use-alias', 'assignment']
const FALLBACK_BINDING_PRIORITY: readonly BindingKind[] = ['part', 'bus']

export function sameRange (a: SourceRange, b: SourceRange): boolean {
  return a.offset === b.offset && a.length === b.length
}

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

export function findReferenceRangesAt (
  model: Model,
  position: number,
  rangesByBinding?: RangesByBinding
): readonly SourceRange[] {
  const binding = findDefinitionBindingAt(model, position)
  if (binding == null) {
    return []
  }

  const ranges = rangesByBinding ?? buildReferenceRangesByBinding(model)

  return ranges.get(binding.id) ?? []
}

export function buildReferenceRangesByBinding (model: Model): RangesByBinding {
  const rangesByBinding = new Map<string, Map<string, SourceRange>>()

  walkResolvedIdentifierBindings(model, (occurrence, binding) => {
    const range = getReferenceRangeForBindingOccurrence(occurrence, binding)
    if (range == null) {
      return
    }

    const key = `${range.offset}:${range.length}`
    const existingRanges = rangesByBinding.get(binding.id)
    if (existingRanges == null) {
      rangesByBinding.set(binding.id, new Map([[key, range]]))
      return
    }

    existingRanges.set(key, range)
  })

  const sortedByBinding = new Map<string, readonly SourceRange[]>()

  for (const [bindingId, ranges] of rangesByBinding) {
    const sortedRanges = [...ranges.values()].sort((left, right) => {
      return left.offset - right.offset || left.length - right.length
    })

    sortedByBinding.set(bindingId, sortedRanges)
  }

  return sortedByBinding
}

export function findUnusedAssignmentBindings (model: Model): readonly Binding[] {
  const usedBindings = new Set<string>()

  walkResolvedIdentifierBindings(model, (occurrence, binding) => {
    if (binding.kind === 'assignment' && !sameRange(binding.range, occurrence.range)) {
      usedBindings.add(binding.id)
    }
  })

  return model.bindings.filter((binding) => {
    return binding.kind === 'assignment' && !usedBindings.has(binding.id)
  })
}

export function resolveDefinitionBinding (model: Model, occurrence: Identifier): Binding | undefined {
  switch (occurrence.kind) {
    case 'PropertyName':
      return undefined

    case 'VariableDefinition':
    case 'UseAlias':
      return findBindingBySpan(model, occurrence)

    case 'Callee':
      return findFirstGlobalBinding(model, occurrence.name)

    case 'VariableName':
      return resolveVariableBinding(model, occurrence)

    case 'MemberAccess':
      return resolveExplicitBusBinding(model, occurrence)

    default:
      occurrence.kind satisfies never
  }
}

function resolveVariableBinding (model: Model, occurrence: Identifier): Binding | undefined {
  const { name } = occurrence

  const scope = model.scopes.get(occurrence.scopeId)

  const part = scope?.kind === 'track' ? findScopedBinding(model, scope.id, name, 'part') : undefined
  if (part != null) {
    return part
  }

  const bus = scope?.kind === 'mixer' ? findScopedBinding(model, scope.id, name, 'bus') : undefined
  if (bus != null) {
    return bus
  }

  return findFirstGlobalBinding(model, name) ?? findFallbackScopedBinding(model, name)
}

function getReferenceRangeForBindingOccurrence (
  occurrence: Identifier,
  binding: Binding
): SourceRange | undefined {
  if (occurrence.kind === 'PropertyName') {
    return undefined
  }

  if (binding.kind === 'bus' && isExplicitBusReference(occurrence) && occurrence.name === binding.name) {
    return occurrence.range
  }

  return occurrence.name === binding.name ? occurrence.range : undefined
}

type OccurrenceVisitor = (occurrence: Identifier, binding: Binding) => void

function resolveExplicitBusBinding (model: Model, occurrence: Identifier): Binding | undefined {
  if (!isExplicitBusReference(occurrence)) {
    return undefined
  }

  return findBindingByPriority(model.bindingsByName.get(occurrence.name), ['bus'], occurrence.name)
}

function walkResolvedIdentifierBindings (model: Model, visitor: OccurrenceVisitor): void {
  for (const identifier of model.identifiers) {
    const binding = resolveDefinitionBinding(model, identifier)
    if (binding != null) {
      visitor(identifier, binding)
    }
  }
}

function findBindingBySpan (model: Model, occurrence: Identifier): Binding | undefined {
  const bindings = model.bindingsByName.get(occurrence.name)
  return bindings?.find((binding) => sameRange(binding.range, occurrence.range))
}

function findFirstGlobalBinding (model: Model, name: string): Binding | undefined {
  return findBindingByPriority(model.bindingsByName.get(name), GLOBAL_BINDING_PRIORITY)
}

function findScopedBinding (model: Model, scopeId: string, name: string, kind: 'part' | 'bus'): Binding | undefined {
  return findBindingByPriority(model.bindingsByScope.get(scopeId), [kind], name)
}

function findFallbackScopedBinding (model: Model, name: string): Binding | undefined {
  return findBindingByPriority(model.bindingsByName.get(name), FALLBACK_BINDING_PRIORITY)
}

function findBindingByPriority (
  bindings: readonly Binding[] | undefined,
  kinds: readonly BindingKind[],
  name?: string
): Binding | undefined {
  if (bindings == null) {
    return undefined
  }

  for (const kind of kinds) {
    const binding = bindings.find((candidate) => {
      return candidate.kind === kind && (name == null || candidate.name === name)
    })

    if (binding != null) {
      return binding
    }
  }

  return undefined
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

function isExplicitBusReference (identifier: Identifier): boolean {
  const chain = computeAccessChain(identifier)
  return chain.length === 2 && chain[0].name === 'bus'
}
