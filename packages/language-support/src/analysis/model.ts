import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import type { SourceRange, TextLike } from '../types.js'
import { textFromString, toSourceRange } from './text.js'

export interface Model {
  readonly rootScopeId: string
  readonly scopes: ReadonlyMap<string, Scope>
  readonly identifiers: readonly Identifier[]
  readonly bindings: readonly Binding[]
  readonly bindingsByName: ReadonlyMap<string, readonly Binding[]>
  readonly bindingsByScope: ReadonlyMap<string, readonly Binding[]>
  readonly imports: readonly ImportStatement[]
}

// scope

export interface Scope {
  readonly id: string
  readonly kind: ScopeKind
  readonly parentId?: string
  readonly range: SourceRange
}

export type ScopeKind = 'root' | 'track' | 'mixer'

// identifier

export interface Identifier {
  readonly id: string
  readonly kind: IdentifierKind
  readonly name: string
  readonly range: SourceRange
}

const IDENTIFIER_KINDS = [
  'VariableName',
  'Callee',
  'MemberAccess',
  'PropertyName',
  'VariableDefinition',
  'UseAlias'
] as const

export type IdentifierKind = typeof IDENTIFIER_KINDS[number]

export function isIdentifierKind (value: string): value is IdentifierKind {
  return IDENTIFIER_KINDS.includes(value as IdentifierKind)
}

// binding

export interface Binding {
  readonly id: string
  readonly kind: BindingKind
  readonly scopeId: string
  readonly name: string
  readonly range: SourceRange
}

export type BindingKind = 'assignment' | 'use-alias' | 'part' | 'bus'

// import

export interface ImportStatement {
  readonly moduleName: string
  readonly alias?: string
  readonly aliasRange?: SourceRange
}

// analysis

interface DefinitionBindingContext {
  readonly parentType: string | undefined
  readonly currentScopeId: string
  readonly trackScopeId: string | undefined
  readonly mixerScopeId: string | undefined
  readonly assignmentHasEquals: boolean
}

// public API

export function analyzeTree (tree: Tree, document: TextLike): Model {
  const rootRange = toSourceRange(document, 0, document.length)

  const rootScopeId = scopeKey('Root', rootRange)

  const scopes = new Map<string, Scope>()
  scopes.set(rootScopeId, {
    id: rootScopeId,
    kind: 'root',
    range: rootRange
  })

  const identifiers: Identifier[] = []
  const bindings: Binding[] = []
  const bindingsByName = new Map<string, Binding[]>()
  const bindingsByScope = new Map<string, Binding[]>()
  const imports: ImportStatement[] = []

  const addIdentifier = (input: Omit<Identifier, 'id'>): void => {
    identifiers.push({ ...input, id: identifierKey(input.kind, input.range) })
  }

  const addBinding = (input: Omit<Binding, 'id'>): void => {
    const { kind, scopeId, name, range } = input

    const binding = { ...input, id: bindingKey(kind, scopeId, range) }
    bindings.push(binding)

    appendIndexedValue(bindingsByName, name, binding)
    appendIndexedValue(bindingsByScope, scopeId, binding)
  }

  const cursor = tree.cursor()

  const walk = (
    cursor: TreeCursor,
    parentType: string | undefined,
    currentScopeId: string,
    trackScopeId: string | undefined,
    mixerScopeId: string | undefined,
    assignmentHasEquals: boolean
  ): void => {
    const typeName = cursor.type.name
    const from = cursor.from
    const to = cursor.to

    const range = toSourceRange(document, from, to)

    const nextParentType = typeName

    let nextScopeId = currentScopeId
    let nextTrackScopeId = trackScopeId
    let nextMixerScopeId = mixerScopeId
    let nextAssignmentHasEquals = assignmentHasEquals

    switch (typeName) {
      case 'UseStatement': {
        const statement = parseUseStatement(document, cursor.node)
        if (statement != null) {
          imports.push(statement)
          if (statement.alias != null && statement.aliasRange != null) {
            addIdentifier({ kind: 'UseAlias', name: statement.alias, range: statement.aliasRange })
            addBinding({ kind: 'use-alias', scopeId: currentScopeId, name: statement.alias, range: statement.aliasRange })
          }
        }
        break
      }

      case 'TrackStatement': {
        const id = scopeKey(typeName, range)
        scopes.set(id, { id, kind: 'track', range, parentId: currentScopeId })
        nextScopeId = id
        nextTrackScopeId = id
        break
      }

      case 'MixerStatement': {
        const id = scopeKey(typeName, range)
        scopes.set(id, { id, kind: 'mixer', range, parentId: currentScopeId })
        nextScopeId = id
        nextMixerScopeId = id
        break
      }

      case 'Assignment': {
        nextAssignmentHasEquals = document.sliceString(from, to).includes('=')
        break
      }

      case 'VariableDefinition': {
        const name = document.sliceString(from, to)

        const binding = getDefinitionBinding({
          parentType,
          currentScopeId,
          trackScopeId: nextTrackScopeId,
          mixerScopeId: nextMixerScopeId,
          assignmentHasEquals: nextAssignmentHasEquals
        })

        if (binding == null) {
          // Invalid/incomplete syntax encountered.
          // We still add an identifier as a best-effort approach to provide some level of functionality.
          addIdentifier({ kind: 'VariableName', name, range })
          break
        }

        addIdentifier({ kind: 'VariableDefinition', name, range })
        addBinding({ ...binding, name, range })

        break
      }

      case 'VariableName':
      case 'Callee':
      case 'MemberAccess':
      case 'PropertyName': {
        const name = document.sliceString(from, to)
        addIdentifier({ kind: typeName, name, range })
        break
      }
    }

    if (cursor.firstChild()) {
      do {
        walk(cursor, nextParentType, nextScopeId, nextTrackScopeId, nextMixerScopeId, nextAssignmentHasEquals)
      } while (cursor.nextSibling())
      cursor.parent()
    }
  }

  walk(cursor, undefined, rootScopeId, undefined, undefined, false)

  identifiers.sort((a, b) => a.range.offset - b.range.offset)
  bindings.sort((a, b) => a.range.offset - b.range.offset)

  return { rootScopeId, scopes, identifiers, bindings, bindingsByName, bindingsByScope, imports }
}

export function analyzeSourceWithParser (parser: LRParser, source: string): Model {
  const tree = parser.parse(source)
  return analyzeTree(tree, textFromString(source))
}

export function scopeKey (typeName: string, range: SourceRange): string {
  return `${typeName}:${range.offset}:${range.length}`
}

function identifierKey (kind: IdentifierKind, range: SourceRange): string {
  return `${kind}:${range.offset}:${range.length}`
}

function bindingKey (kind: BindingKind, scopeId: string, range: SourceRange): string {
  return `${kind}:${scopeId}:${range.offset}:${range.length}`
}

function appendIndexedValue<Key, Value> (index: Map<Key, Value[]>, key: Key, value: Value): void {
  const values = index.get(key)
  if (values == null) {
    index.set(key, [value])
    return
  }

  values.push(value)
}

function getDefinitionBinding (context: DefinitionBindingContext): Omit<Binding, 'id' | 'name' | 'range'> | undefined {
  switch (context.parentType) {
    case 'Assignment':
      return context.assignmentHasEquals
        ? { kind: 'assignment', scopeId: context.currentScopeId }
        : undefined

    case 'PartStatement':
      return context.trackScopeId != null
        ? { kind: 'part', scopeId: context.trackScopeId }
        : undefined

    case 'BusStatement':
      return context.mixerScopeId != null
        ? { kind: 'bus', scopeId: context.mixerScopeId }
        : undefined
  }

  return undefined
}

function parseUseStatement (document: TextLike, node: SyntaxNode): ImportStatement | undefined {
  let moduleName: string | undefined
  let alias: string | undefined
  let aliasRange: SourceRange | undefined

  const cursor = node.cursor()

  if (cursor.firstChild()) {
    do {
      switch (cursor.type.name) {
        case 'String':
          moduleName ??= parseStringLiteral(document.sliceString(cursor.from, cursor.to))
          break
        case 'UseAlias':
          alias ??= document.sliceString(cursor.from, cursor.to)
          aliasRange ??= toSourceRange(document, cursor.from, cursor.to)
          break
      }
    } while (cursor.nextSibling())
  }

  if (moduleName == null || alias == null) {
    return undefined
  }

  return {
    moduleName,
    alias: alias === '*' ? undefined : alias,
    aliasRange
  }
}

// TODO Use proper string parsing instead of JSON.parse
function parseStringLiteral (text: string): string | undefined {
  try {
    const value = JSON.parse(text)
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined
  }
}
