import type { Tree, TreeCursor } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import type { SourceRange } from '../types.js'
import type { TextLike } from './text.js'
import { textFromString, toSourceRange } from './text.js'

export type ScopeKind = 'root' | 'track' | 'mixer'

export interface Scope {
  readonly id: string
  readonly kind: ScopeKind
  readonly parentId?: string
  readonly range: SourceRange
}

export type BindingKind = 'assignment' | 'use-alias' | 'part' | 'bus'

export interface Binding {
  readonly id: string
  readonly kind: BindingKind
  readonly scopeId: string
  readonly name: string
  readonly range: SourceRange
}

export interface Model {
  readonly rootScopeId: string
  readonly scopes: ReadonlyMap<string, Scope>
  readonly bindings: readonly Binding[]
  readonly bindingsByName: ReadonlyMap<string, readonly Binding[]>
  readonly bindingsByScope: ReadonlyMap<string, readonly Binding[]>
}

interface BindingInput {
  readonly kind: BindingKind
  readonly scopeId: string
  readonly name: string
  readonly range: SourceRange
}

interface DefinitionBindingContext {
  readonly parentType: string | undefined
  readonly currentScopeId: string
  readonly trackScopeId: string | undefined
  readonly mixerScopeId: string | undefined
  readonly assignmentHasEquals: boolean
}

export function analyzeTree (tree: Tree, document: TextLike): Model {
  const rootRange = toSourceRange(document, 0, document.length)

  const rootScopeId = scopeKey('Root', rootRange)

  const scopes = new Map<string, Scope>()
  scopes.set(rootScopeId, {
    id: rootScopeId,
    kind: 'root',
    range: rootRange
  })

  const bindings: Binding[] = []
  const bindingsByName = new Map<string, Binding[]>()
  const bindingsByScope = new Map<string, Binding[]>()

  const addBinding = (input: BindingInput): void => {
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

        if (binding != null) {
          addBinding({ ...binding, name, range })
        }

        break
      }

      case 'UseAlias': {
        const name = document.sliceString(from, to)
        if (name !== '*') {
          addBinding({ kind: 'use-alias', scopeId: currentScopeId, name, range })
        }
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

  return { rootScopeId, scopes, bindings, bindingsByName, bindingsByScope }
}

export function analyzeSourceWithParser (parser: LRParser, source: string): Model {
  const tree = parser.parse(source)
  return analyzeTree(tree, textFromString(source))
}

export function scopeKey (typeName: string, range: SourceRange): string {
  return `${typeName}:${range.offset}:${range.length}`
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

function getDefinitionBinding (context: DefinitionBindingContext): Omit<BindingInput, 'name' | 'range'> | undefined {
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
