import type { SourceRange, TextLike } from '../types.js'
import type { Binding, BindingKind, Identifier, Model } from './model.js'
import { toSourceRange } from './text.js'

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

export function findDefinitionBindingAt (model: Model, document: TextLike, position: number): Binding | undefined {
  const occurrence = findIdentifierAt(model, position, 'inclusive')
  if (occurrence == null) {
    return undefined
  }

  return resolveDefinitionBinding(model, occurrence, document)
}

export type RangesByBinding = ReadonlyMap<string, readonly SourceRange[]>

export function findReferenceRangesAt (
  model: Model,
  document: TextLike,
  position: number,
  rangesByBinding?: RangesByBinding
): readonly SourceRange[] {
  const binding = findDefinitionBindingAt(model, document, position)
  if (binding == null) {
    return []
  }

  const ranges = rangesByBinding ?? buildReferenceRangesByBinding(model, document)

  return ranges.get(binding.id) ?? []
}

export function buildReferenceRangesByBinding (model: Model, document: TextLike): RangesByBinding {
  const rangesByBinding = new Map<string, Map<string, SourceRange>>()

  walkResolvedIdentifierBindings(model, document, (occurrence, binding) => {
    const range = getReferenceRangeForBindingOccurrence(occurrence, document, binding)
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

export function findUnusedAssignmentBindings (model: Model, document: TextLike): readonly Binding[] {
  const usedBindings = new Set<string>()

  walkResolvedIdentifierBindings(model, document, (occurrence, binding) => {
    if (binding.kind === 'assignment' && !sameRange(binding.range, occurrence.range)) {
      usedBindings.add(binding.id)
    }
  })

  return model.bindings.filter((binding) => {
    return binding.kind === 'assignment' && !usedBindings.has(binding.id)
  })
}

export function resolveDefinitionBinding (model: Model, occurrence: Identifier, document: TextLike): Binding | undefined {
  switch (occurrence.kind) {
    case 'PropertyName':
      return undefined

    case 'VariableDefinition':
    case 'UseAlias':
      return findBindingBySpan(model, occurrence)

    case 'Callee':
      return findFirstGlobalBinding(model, occurrence.name)

    case 'VariableName':
      return resolveVariableBinding(model, occurrence, document)

    case 'MemberAccess':
      return resolveExplicitBusBinding(model, occurrence, document)

    default:
      occurrence.kind satisfies never
  }
}

function resolveVariableBinding (model: Model, occurrence: Identifier, document: TextLike): Binding | undefined {
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
  document: TextLike,
  binding: Binding
): SourceRange | undefined {
  if (occurrence.kind === 'PropertyName') {
    return undefined
  }

  const explicitBusRange = findExplicitBusBindingRange(document, occurrence.range.offset)
  if (binding.kind === 'bus' && explicitBusRange != null) {
    const busName = document.sliceString(explicitBusRange.offset, explicitBusRange.offset + explicitBusRange.length)
    if (busName === binding.name) {
      return explicitBusRange
    }
  }

  return occurrence.name === binding.name ? occurrence.range : undefined
}

type OccurrenceVisitor = (occurrence: Identifier, binding: Binding) => void

function resolveExplicitBusBinding (model: Model, occurrence: Identifier, document: TextLike): Binding | undefined {
  const explicitBusRange = findExplicitBusBindingRange(document, occurrence.range.offset)
  if (explicitBusRange == null) {
    return undefined
  }

  const busName = document.sliceString(explicitBusRange.offset, explicitBusRange.offset + explicitBusRange.length)
  return findBindingByPriority(model.bindingsByName.get(busName), ['bus'], busName)
}

function walkResolvedIdentifierBindings (model: Model, document: TextLike, visitor: OccurrenceVisitor): void {
  for (const identifier of model.identifiers) {
    const binding = resolveDefinitionBinding(model, identifier, document)
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

function getWordRangeAt (document: TextLike, position: number): SourceRange | undefined {
  if (position < 0 || position > document.length) {
    return undefined
  }

  const right = charAt(document, position)
  const left = charAt(document, position - 1)
  const anchor = isWordChar(right) ? position : (isWordChar(left) ? position - 1 : undefined)
  if (anchor == null) {
    return undefined
  }

  let from = anchor
  while (from > 0 && isWordChar(charAt(document, from - 1))) {
    --from
  }

  let to = anchor + 1
  while (to < document.length && isWordChar(charAt(document, to))) {
    ++to
  }

  return toSourceRange(document, from, to)
}

export function computeAccessChain (model: Model, document: TextLike, member: Identifier): readonly Identifier[] {
  const identifiers: Identifier[] = []

  let currentMember: Identifier | undefined = member
  while (currentMember != null) {
    identifiers.push(currentMember)

    const rangeBefore = findAccessChainRootBefore(document, currentMember.range.offset, 1)
    if (rangeBefore == null) {
      break
    }

    currentMember = findIdentifierAt(model, rangeBefore.offset, 'strict')
  }

  // reverse to get chain in order from left to right (e.g. "foo.bar.baz" -> ["foo", "bar", "baz"])
  return identifiers.reverse()
}

function findAccessChainRootBefore (document: TextLike, memberFrom: number, limit?: number): SourceRange | undefined {
  const dot = charBeforeNonWhitespace(document, memberFrom)
  if (dot == null || dot.char !== '.') {
    return undefined
  }

  let steps = 0
  let root: SourceRange | undefined
  let currentDotIndex = dot.index

  while (currentDotIndex >= 0 && (limit == null || steps < limit)) {
    const wordEnd = skipWhitespaceLeft(document, currentDotIndex)
    const range = getWordRangeAt(document, wordEnd)
    if (range == null) {
      break
    }

    root = range

    const beforeWord = charBeforeNonWhitespace(document, range.offset)
    if (beforeWord == null || beforeWord.char !== '.') {
      break
    }

    currentDotIndex = beforeWord.index
    ++steps
  }

  return root
}

function findExplicitBusBindingRange (document: TextLike, memberFrom: number): SourceRange | undefined {
  const root = findAccessChainRootBefore(document, memberFrom, 1)
  if (root == null) {
    return undefined
  }

  const rootName = document.sliceString(root.offset, root.offset + root.length)
  if (rootName !== 'bus') {
    return undefined
  }

  return findAccessChainFirstMemberAfter(document, root)
}

function findAccessChainFirstMemberAfter (document: TextLike, root: SourceRange): SourceRange | undefined {
  const dot = charAfterNonWhitespace(document, root.offset + root.length)
  if (dot == null || dot.char !== '.') {
    return undefined
  }

  const memberStart = skipWhitespaceRight(document, dot.index + 1)
  return getWordRangeAt(document, memberStart)
}

function charAt (document: TextLike, index: number): string {
  return index >= 0 && index < document.length ? document.sliceString(index, index + 1) : ''
}

function isWhitespace (char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

function skipWhitespaceLeft (document: TextLike, position: number): number {
  for (let pos = position; pos > 0; --pos) {
    if (!isWhitespace(charAt(document, pos - 1))) {
      return pos
    }
  }

  return 0
}

function skipWhitespaceRight (document: TextLike, position: number): number {
  for (let pos = position; pos < document.length; ++pos) {
    if (!isWhitespace(charAt(document, pos))) {
      return pos
    }
  }

  return document.length
}

function charBeforeNonWhitespace (document: TextLike, position: number): { readonly index: number, readonly char: string } | undefined {
  for (let pos = position; pos > 0; --pos) {
    const char = charAt(document, pos - 1)
    if (!isWhitespace(char)) {
      return { index: pos - 1, char }
    }
  }

  return undefined
}

function charAfterNonWhitespace (document: TextLike, position: number): { readonly index: number, readonly char: string } | undefined {
  for (let pos = position; pos < document.length; ++pos) {
    const char = charAt(document, pos)
    if (!isWhitespace(char)) {
      return { index: pos, char }
    }
  }

  return undefined
}

const WORD_REGEXP = /[a-zA-Z_0-9#]/

function isWordChar (char: string): boolean {
  return char.length === 1 && WORD_REGEXP.test(char)
}
