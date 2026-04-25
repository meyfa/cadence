import type { Tree, TreeCursor } from '@lezer/common'
import type { LRParser } from '@lezer/lr'

export interface TextLike {
  readonly length: number
  readonly sliceString: (from: number, to?: number) => string
}

export type ScopeKind = 'root' | 'track' | 'mixer'

export interface Scope {
  readonly id: string
  readonly kind: ScopeKind
  readonly from: number
  readonly to: number
  readonly parentId?: string
}

export type BindingKind = 'assignment' | 'use-alias' | 'part' | 'bus'

export interface Binding {
  readonly id: string
  readonly kind: BindingKind
  readonly scopeId: string
  readonly name: string
  readonly from: number
  readonly to: number
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
  readonly from: number
  readonly to: number
}

interface DefinitionBindingContext {
  readonly parentType: string | undefined
  readonly currentScopeId: string
  readonly trackScopeId: string | undefined
  readonly mixerScopeId: string | undefined
  readonly assignmentHasEquals: boolean
}

export function analyzeTree (tree: Tree, document: TextLike): Model {
  const rootScopeId = scopeKey('Root', 0, document.length)

  const scopes = new Map<string, Scope>()

  scopes.set(rootScopeId, {
    id: rootScopeId,
    kind: 'root',
    from: 0,
    to: document.length
  })

  const bindings: Binding[] = []
  const bindingsByName = new Map<string, Binding[]>()
  const bindingsByScope = new Map<string, Binding[]>()

  const addBinding = (input: BindingInput): void => {
    const { kind, scopeId, name, from, to } = input

    const binding = { ...input, id: bindingKey(kind, scopeId, from, to) }
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

    const nextParentType = typeName

    let nextScopeId = currentScopeId
    let nextTrackScopeId = trackScopeId
    let nextMixerScopeId = mixerScopeId
    let nextAssignmentHasEquals = assignmentHasEquals

    switch (typeName) {
      case 'TrackStatement': {
        const id = scopeKey(typeName, from, to)
        scopes.set(id, { id, kind: 'track', from, to, parentId: currentScopeId })
        nextScopeId = id
        nextTrackScopeId = id
        break
      }

      case 'MixerStatement': {
        const id = scopeKey(typeName, from, to)
        scopes.set(id, { id, kind: 'mixer', from, to, parentId: currentScopeId })
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
          addBinding({ ...binding, name, from, to })
        }

        break
      }

      case 'UseAlias': {
        const name = document.sliceString(from, to)
        if (name !== '*') {
          addBinding({ kind: 'use-alias', scopeId: currentScopeId, name, from, to })
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
  return analyzeTree(tree, {
    length: source.length,
    sliceString: (from, to) => source.slice(from, to)
  })
}

export function scopeKey (typeName: string, from: number, to: number): string {
  return `${typeName}:${from}:${to}`
}

function bindingKey (kind: BindingKind, scopeId: string, from: number, to: number): string {
  return `${kind}:${scopeId}:${from}:${to}`
}

function appendIndexedValue<Key, Value> (index: Map<Key, Value[]>, key: Key, value: Value): void {
  const values = index.get(key)
  if (values == null) {
    index.set(key, [value])
    return
  }

  values.push(value)
}

function getDefinitionBinding (context: DefinitionBindingContext): Omit<BindingInput, 'name' | 'from' | 'to'> | undefined {
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
