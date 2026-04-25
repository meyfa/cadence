import type { SyntaxNode, Tree } from '@lezer/common'
import type { SourceRange } from '../types.js'
import type { Binding, BindingKind, Model } from './model.js'
import { scopeKey } from './model.js'
import type { TextLike } from './text.js'
import { toSourceRange } from './text.js'

export type IdentifierKind = typeof IDENTIFIER_KINDS[number]

export interface SemanticOccurrence {
  readonly kind: IdentifierKind | undefined
  readonly name: string
  readonly range: SourceRange
  readonly node?: SyntaxNode
}

const IDENTIFIER_KINDS = [
  'VariableName',
  'Callee',
  'MemberAccess',
  'PropertyName',
  'VariableDefinition',
  'UseAlias'
] as const

const GLOBAL_BINDING_PRIORITY: readonly BindingKind[] = ['use-alias', 'assignment']
const FALLBACK_BINDING_PRIORITY: readonly BindingKind[] = ['part', 'bus']

function isIdentifierKind (value: string): value is IdentifierKind {
  return IDENTIFIER_KINDS.includes(value as IdentifierKind)
}

export function sameRange (a: SourceRange, b: SourceRange): boolean {
  return a.offset === b.offset && a.length === b.length
}

export function findIdentifierRangeAt (tree: Tree, document: TextLike, position: number): SourceRange | undefined {
  const node = findIdentifierNodeAt(tree, position)
  if (node == null) {
    return undefined
  }

  return toSourceRange(document, node.from, node.to)
}

export function findDefinitionBindingAt (model: Model, tree: Tree, document: TextLike, position: number): Binding | undefined {
  const occurrence = findSemanticOccurrenceAt(tree, document, position)
  return occurrence != null && occurrence.name.length > 0
    ? resolveDefinitionBinding(model, occurrence, document)
    : undefined
}

export function findUnusedAssignmentBindings (model: Model, tree: Tree, document: TextLike): readonly Binding[] {
  const usedBindings = new Set<string>()
  const cursor = tree.cursor()

  const walk = (): void => {
    if (isIdentifierKind(cursor.type.name)) {
      const occurrence = findSemanticOccurrenceAt(tree, document, cursor.from)
      const binding = occurrence == null ? undefined : resolveDefinitionBinding(model, occurrence, document)

      if (occurrence != null && binding?.kind === 'assignment' && !sameRange(binding.range, occurrence.range)) {
        usedBindings.add(binding.id)
      }
    }

    if (cursor.firstChild()) {
      do {
        walk()
      } while (cursor.nextSibling())
      cursor.parent()
    }
  }

  walk()

  return model.bindings.filter((binding) => {
    return binding.kind === 'assignment' && !usedBindings.has(binding.id)
  })
}

function findSemanticOccurrenceAt (tree: Tree, document: TextLike, position: number): SemanticOccurrence | undefined {
  const node = findIdentifierNodeAt(tree, position)
  if (node != null) {
    return {
      kind: node.type.name as IdentifierKind,
      name: document.sliceString(node.from, node.to),
      node,
      range: toSourceRange(document, node.from, node.to)
    }
  }

  const range = getWordRangeAt(document, position)
  return range != null
    ? { kind: undefined, name: document.sliceString(range.offset, range.offset + range.length), range }
    : undefined
}

function resolveDefinitionBinding (model: Model, occurrence: SemanticOccurrence, document: TextLike): Binding | undefined {
  const name = occurrence.name
  const effectiveKind = getEffectiveOccurrenceKind(occurrence, document)

  switch (effectiveKind) {
    case 'VariableDefinition':
    case 'UseAlias':
      return findBindingBySpan(model, occurrence)

    case 'PropertyName':
      return undefined

    case 'Callee':
      return findFirstGlobalBinding(model, name)
  }

  const root = findAccessChainRootBefore(document, occurrence.range.offset)
  if (root != null) {
    const rootName = document.sliceString(root.offset, root.offset + root.length)
    if (rootName.length > 0 && rootName !== name) {
      const resolvedRoot = resolveDefinitionBinding(model, {
        kind: 'VariableName',
        name: rootName,
        node: occurrence.node,
        range: root
      }, document)

      if (resolvedRoot != null) {
        return resolvedRoot
      }
    }
  }

  const trackScopeId = findEnclosingScopeId(document, occurrence.node, 'TrackStatement')
  if (trackScopeId != null) {
    const definition = findScopedBinding(model, trackScopeId, name, 'part')
    if (definition != null) {
      return definition
    }
  }

  const mixerScopeId = findEnclosingScopeId(document, occurrence.node, 'MixerStatement')
  if (mixerScopeId != null) {
    const definition = findScopedBinding(model, mixerScopeId, name, 'bus')
    if (definition != null) {
      return definition
    }
  }

  return findFirstGlobalBinding(model, name) ?? findFallbackScopedBinding(model, name)
}

function getEffectiveOccurrenceKind (occurrence: SemanticOccurrence, document: TextLike): IdentifierKind | undefined {
  const parent = occurrence.node?.parent

  // Fix cases where Lezer classifies an identifier as a VariableDefinition even when
  // it is not actually defining a variable.
  let isCorrect = true

  if (occurrence.kind === 'VariableDefinition' && parent != null) {
    switch (parent.type.name) {
      case 'Assignment':
        isCorrect = document.sliceString(parent.from, parent.to).includes('=')
        break
      case 'PartStatement':
        isCorrect = /^\s*part\b/.test(document.sliceString(parent.from, parent.from + 16))
        break
      case 'BusStatement':
        isCorrect = /^\s*bus\b/.test(document.sliceString(parent.from, parent.from + 16))
        break
    }
  }

  return isCorrect ? occurrence.kind : 'VariableName'
}

function findBindingBySpan (model: Model, occurrence: SemanticOccurrence): Binding | undefined {
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

function findIdentifierNodeAt (tree: Tree, position: number): SyntaxNode | undefined {
  const maxDepth = 8
  let node: SyntaxNode | undefined = tree.resolveInner(position, -1)

  for (let depth = 0; depth < maxDepth && node != null; ++depth) {
    if (isIdentifierKind(node.type.name)) {
      return node
    }

    node = node.parent ?? undefined
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

function findEnclosingScopeId (
  document: TextLike,
  node: SyntaxNode | undefined,
  scopeTypeName: 'TrackStatement' | 'MixerStatement'
): string | undefined {
  for (let current = node; current != null; current = current.parent ?? undefined) {
    if (current.type.name === scopeTypeName) {
      return scopeKey(current.type.name, toSourceRange(document, current.from, current.to))
    }
  }

  return undefined
}

function findAccessChainRootBefore (document: TextLike, memberFrom: number): SourceRange | undefined {
  const dot = charBeforeNonWhitespace(document, memberFrom)
  if (dot == null || dot.char !== '.') {
    return undefined
  }

  let root: SourceRange | undefined
  let currentDotIndex = dot.index

  while (currentDotIndex >= 0) {
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
  }

  return root
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

function charBeforeNonWhitespace (document: TextLike, position: number): { readonly index: number, readonly char: string } | undefined {
  for (let pos = position; pos > 0; --pos) {
    const char = charAt(document, pos - 1)
    if (!isWhitespace(char)) {
      return { index: pos - 1, char }
    }
  }

  return undefined
}

const WORD_REGEXP = /[a-zA-Z_0-9#]/

function isWordChar (char: string): boolean {
  return char.length === 1 && WORD_REGEXP.test(char)
}
