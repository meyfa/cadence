import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { LRParser } from '@lezer/lr'

export interface GoToDefinitionResult {
  readonly name: string
  readonly from: number
  readonly to: number
}

interface TextLike {
  readonly length: number
  readonly sliceString: (from: number, to?: number) => string
}

interface WordRange {
  readonly from: number
  readonly to: number
}

const IDENTIFIER_KINDS = [
  'VariableName',
  'Callee',
  'MemberAccess',
  'PropertyName',
  'VariableDefinition',
  'UseAlias'
] as const
type IdentifierKind = typeof IDENTIFIER_KINDS[number]

interface IdentifierAt {
  readonly kind: IdentifierKind | undefined
  readonly name: string
  readonly from: number
  readonly to: number
  readonly node?: SyntaxNode
}

interface DefinitionIndex {
  readonly globalAssignments: ReadonlyMap<string, GoToDefinitionResult>
  readonly globalUseAliases: ReadonlyMap<string, GoToDefinitionResult>
  readonly tracks: ReadonlyMap<string, TrackScope>
  readonly mixers: ReadonlyMap<string, MixerScope>
}

interface TrackScope {
  readonly key: string
  readonly from: number
  readonly to: number
  readonly parts: ReadonlyMap<string, GoToDefinitionResult>
}

interface MixerScope {
  readonly key: string
  readonly from: number
  readonly to: number
  readonly buses: ReadonlyMap<string, GoToDefinitionResult>
}

interface WritableTrackScope extends TrackScope {
  readonly parts: Map<string, GoToDefinitionResult>
}

interface WritableMixerScope extends MixerScope {
  readonly buses: Map<string, GoToDefinitionResult>
}

function isIdentifierKind (value: string): value is IdentifierKind {
  return IDENTIFIER_KINDS.includes(value as IdentifierKind)
}

const WORD_REGEXP = /[a-zA-Z_0-9#]/

function isWordChar (char: string): boolean {
  return char.length === 1 && WORD_REGEXP.test(char)
}

function charAt (document: TextLike, index: number): string {
  return index >= 0 && index < document.length ? document.sliceString(index, index + 1) : ''
}

function getWordRangeAt (document: TextLike, position: number): WordRange | undefined {
  if (position < 0 || position > document.length) {
    return undefined
  }

  // Prefer the character under the cursor; fall back to the left neighbor.
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

  return { from, to }
}

function scopeKey (typeName: string, from: number, to: number): string {
  return `${typeName}:${from}:${to}`
}

function findIdentifierAt (tree: Tree, document: TextLike, position: number): IdentifierAt | undefined {
  const maxDepth = 8
  let node = tree.resolveInner(position, -1)

  // Climb to a meaningful identifier wrapper node.
  for (let depth = 0; depth < maxDepth && node.parent != null; ++depth) {
    if (isIdentifierKind(node.type.name)) {
      const text = document.sliceString(node.from, node.to)
      return { kind: node.type.name, name: text, from: node.from, to: node.to, node }
    }
    node = node.parent
  }

  const range = getWordRangeAt(document, position)
  if (range == null) {
    return undefined
  }

  return {
    kind: undefined,
    name: document.sliceString(range.from, range.to),
    from: range.from,
    to: range.to
  }
}

function findEnclosingScopeKey (node: SyntaxNode | undefined, scopeTypeName: 'TrackStatement' | 'MixerStatement'): string | undefined {
  for (let current = node; current != null; current = current.parent ?? undefined) {
    if (current.type.name === scopeTypeName) {
      return scopeKey(current.type.name, current.from, current.to)
    }
  }
  return undefined
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

function findAccessChainRootBefore (document: TextLike, memberFrom: number): WordRange | undefined {
  // Find the '.' token directly preceding the member name (skipping whitespace).
  const dot = charBeforeNonWhitespace(document, memberFrom)
  if (dot == null || dot.char !== '.') {
    return undefined
  }

  let root: WordRange | undefined
  let currentDotIndex = dot.index

  while (currentDotIndex >= 0) {
    // Find the identifier immediately to the left of the dot.
    const wordEnd = skipWhitespaceLeft(document, currentDotIndex)
    const range = getWordRangeAt(document, wordEnd)
    if (range == null) {
      break
    }

    root = range

    // Continue walking left if this is a chained access: <ident> . <ident> . <member>
    const beforeWord = charBeforeNonWhitespace(document, range.from)
    if (beforeWord == null || beforeWord.char !== '.') {
      break
    }

    currentDotIndex = beforeWord.index
  }

  return root
}

function buildDefinitionIndex (tree: Tree, document: TextLike): DefinitionIndex {
  const globalAssignments = new Map<string, GoToDefinitionResult>()
  const globalUseAliases = new Map<string, GoToDefinitionResult>()

  const tracks = new Map<string, TrackScope>()
  const mixers = new Map<string, MixerScope>()

  const cursor = tree.cursor()

  const walk = (
    cursor: TreeCursor,
    parentType: string | undefined,
    trackScope: WritableTrackScope | undefined,
    mixerScope: WritableMixerScope | undefined,
    assignmentHasEquals: boolean
  ): void => {
    const typeName = cursor.type.name
    const from = cursor.from
    const to = cursor.to

    const nextParentType = typeName

    let nextTrackScope = trackScope
    let nextMixerScope = mixerScope
    let nextAssignmentHasEquals = assignmentHasEquals

    switch (typeName) {
      case 'TrackStatement': {
        const key = scopeKey(typeName, from, to)
        const scope = { key, from, to, parts: new Map<string, GoToDefinitionResult>() }
        tracks.set(key, scope)
        nextTrackScope = scope
        break
      }

      case 'MixerStatement': {
        const key = scopeKey(typeName, from, to)
        const scope = { key, from, to, buses: new Map<string, GoToDefinitionResult>() }
        mixers.set(key, scope)
        nextMixerScope = scope
        break
      }

      case 'Assignment': {
        nextAssignmentHasEquals = document.sliceString(from, to).includes('=')
        break
      }

      case 'VariableDefinition': {
        const name = document.sliceString(from, to)
        const definition = { name, from, to }

        switch (parentType) {
          case 'Assignment':
            // Prefer first definition; duplicates are an error elsewhere.
            if (nextAssignmentHasEquals) {
              globalAssignments.set(name, globalAssignments.get(name) ?? definition)
            }
            break

          case 'PartStatement':
            nextTrackScope?.parts.set(name, nextTrackScope.parts.get(name) ?? definition)
            break

          case 'BusStatement':
            nextMixerScope?.buses.set(name, nextMixerScope.buses.get(name) ?? definition)
            break
        }

        break
      }

      case 'UseAlias': {
        const name = document.sliceString(from, to)
        if (name !== '*') {
          globalUseAliases.set(name, globalUseAliases.get(name) ?? { name, from, to })
        }
        break
      }
    }

    if (cursor.firstChild()) {
      do {
        walk(cursor, nextParentType, nextTrackScope, nextMixerScope, nextAssignmentHasEquals)
      } while (cursor.nextSibling())
      cursor.parent()
    }
  }

  walk(cursor, undefined, undefined, undefined, false)

  return { globalAssignments, globalUseAliases, tracks, mixers }
}

function resolveDefinition (index: DefinitionIndex, identifier: IdentifierAt, document: TextLike): GoToDefinitionResult | undefined {
  const name = identifier.name

  const effectiveKind = ((): IdentifierKind | undefined => {
    if (identifier.kind !== 'VariableDefinition') {
      return identifier.kind
    }

    const parent = identifier.node?.parent
    switch (parent?.type.name) {
      case 'Assignment':
        // Lezer error recovery can classify arbitrary statements as an Assignment with a VariableDefinition
        // even when '=' is missing (e.g. a top-level expression like `lib.foo()`).
        return document.sliceString(parent.from, parent.to).includes('=') ? identifier.kind : 'VariableName'

      case 'PartStatement':
        return /^\s*part\b/.test(document.sliceString(parent.from, Math.min(parent.to, parent.from + 16))) ? identifier.kind : 'VariableName'

      case 'BusStatement':
        return /^\s*bus\b/.test(document.sliceString(parent.from, Math.min(parent.to, parent.from + 16))) ? identifier.kind : 'VariableName'

      default:
        return identifier.kind
    }
  })()

  switch (effectiveKind) {
    // Jumping from a definition jumps to itself.
    case 'VariableDefinition':
    case 'UseAlias':
      return { name, from: identifier.from, to: identifier.to }

    // Named argument keys (e.g. tempo: 140.bpm) are not identifier usages.
    case 'PropertyName':
      return undefined

    // Module aliases are typically used as bare identifiers (e.g. lib in lib.foo()).
    case 'Callee':
      return index.globalUseAliases.get(name) ?? index.globalAssignments.get(name)
  }

  // If this identifier is preceded by a dot, it is likely part of a member access chain.
  // Resolve the root identifier of the chain instead of the member name.
  const root = findAccessChainRootBefore(document, identifier.from)
  if (root != null) {
    const rootName = document.sliceString(root.from, root.to)
    if (rootName.length > 0 && rootName !== name) {
      const resolvedRoot = resolveDefinition(index, {
        kind: 'VariableName',
        name: rootName,
        from: root.from,
        to: root.to,
        node: identifier.node
      }, document)

      if (resolvedRoot != null) {
        return resolvedRoot
      }
    }
  }

  // Remaining kinds: VariableName | undefined

  const trackKey = findEnclosingScopeKey(identifier.node, 'TrackStatement')
  if (trackKey != null) {
    const definition = index.tracks.get(trackKey)?.parts.get(name)
    if (definition != null) {
      return definition
    }
  }

  const mixerKey = findEnclosingScopeKey(identifier.node, 'MixerStatement')
  if (mixerKey != null) {
    const definition = index.mixers.get(mixerKey)?.buses.get(name)
    if (definition != null) {
      return definition
    }
  }

  const global = index.globalAssignments.get(name) ?? index.globalUseAliases.get(name)
  if (global != null) {
    return global
  }

  // Fallback: resolve to any known part/bus definition.
  for (const track of index.tracks.values()) {
    const definition = track.parts.get(name)
    if (definition != null) {
      return definition
    }
  }

  for (const mixer of index.mixers.values()) {
    const definition = mixer.buses.get(name)
    if (definition != null) {
      return definition
    }
  }

  return undefined
}

export function goToDefinitionInTree (tree: Tree, document: TextLike, pos: number): GoToDefinitionResult | undefined {
  const identifier = findIdentifierAt(tree, document, pos)
  if (identifier == null || identifier.name.length === 0) {
    return undefined
  }

  const index = buildDefinitionIndex(tree, document)
  return resolveDefinition(index, identifier, document)
}

export function goToDefinitionWithParser (parser: LRParser, source: string, pos: number): GoToDefinitionResult | undefined {
  const tree = parser.parse(source)
  return goToDefinitionInTree(tree, {
    length: source.length,
    sliceString: (from, to) => source.slice(from, to)
  }, pos)
}
