import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { SourceRange } from '../../utilities/range.js'
import type { TextLike } from '../../utilities/text.js'
import { toSourceRange } from '../../utilities/text.js'
import type { BaseModel, Binding, BindingKind, Identifier, ImportStatement, Scope } from '../model.js'

export function computeBaseModel (tree: Tree, document: TextLike): BaseModel {
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
    assignmentHasEquals: boolean,
    previousSibling?: Identifier
  ): Identifier | undefined => {
    const typeName = cursor.type.name
    const from = cursor.from
    const to = cursor.to

    const range = toSourceRange(document, from, to)

    const nextParentType = typeName

    let nextScopeId = currentScopeId
    let nextTrackScopeId = trackScopeId
    let nextMixerScopeId = mixerScopeId
    let nextAssignmentHasEquals = assignmentHasEquals
    let accessChainTail: Identifier | undefined

    switch (typeName) {
      case 'UseStatement': {
        const statement = parseUseStatement(document, cursor.node)
        if (statement != null) {
          imports.push(statement)
          if (statement.alias != null && statement.aliasRange != null) {
            identifiers.push({ kind: 'UseAlias', scopeId: currentScopeId, name: statement.alias, range: statement.aliasRange })
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
        nextAssignmentHasEquals = false

        cursor.node.cursor().iterate((node) => {
          if (node.type.name === '=') {
            nextAssignmentHasEquals = true
            return false
          }
          return true
        })

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
          accessChainTail = { kind: 'VariableName', scopeId: currentScopeId, name, range, previousSibling }
          identifiers.push(accessChainTail)
          break
        }

        identifiers.push({ kind: 'VariableDefinition', scopeId: currentScopeId, name, range })
        addBinding({ ...binding, name, range })

        break
      }

      case 'PropertyName': {
        const name = document.sliceString(from, to)
        identifiers.push({ kind: typeName, scopeId: currentScopeId, name, range })
        break
      }

      case 'VariableName':
      case 'Callee':
      case 'MemberAccess':
      case 'BusNamespace': {
        let kind = typeName === 'BusNamespace' ? 'VariableName' : typeName
        if (kind !== 'Callee' && previousSibling != null) {
          kind = 'MemberAccess'
        }

        const name = document.sliceString(from, to)
        accessChainTail = { kind, scopeId: currentScopeId, name, range, previousSibling }
        identifiers.push(accessChainTail)

        break
      }
    }

    // The parser defaults to 'Assignment' for incomplete syntax (e.g. standalone 'fx.delay'),
    // so we use heuristics to still collect identifiers in that case.
    const trackAccessChain = typeName === 'AccessOrCall' || (typeName === 'Assignment' && !nextAssignmentHasEquals)

    let nextPreviousSibling = previousSibling

    if (cursor.firstChild()) {
      do {
        const childTypeName = cursor.type.name

        const childPreviousSibling = (() => {
          if (typeName === 'Call') {
            return childTypeName === 'Callee' ? previousSibling : undefined
          }

          return trackAccessChain && shouldKeepPreviousSibling(cursor.node)
            ? nextPreviousSibling
            : undefined
        })()

        const childAccessChainTail = walk(
          cursor,
          nextParentType,
          nextScopeId,
          nextTrackScopeId,
          nextMixerScopeId,
          nextAssignmentHasEquals,
          childPreviousSibling
        )

        if (typeName === 'Call') {
          accessChainTail ??= childAccessChainTail
          continue
        }

        if (trackAccessChain && childAccessChainTail != null) {
          nextPreviousSibling = childAccessChainTail
          accessChainTail = childAccessChainTail
        }
      } while (cursor.nextSibling())
      cursor.parent()
    }

    return accessChainTail
  }

  walk(cursor, undefined, rootScopeId, undefined, undefined, false)

  identifiers.sort((a, b) => a.range.offset - b.range.offset)
  bindings.sort((a, b) => a.range.offset - b.range.offset)

  return { rootScopeId, scopes, identifiers, bindings, bindingsByName, bindingsByScope, imports }
}

interface DefinitionBindingContext {
  readonly parentType: string | undefined
  readonly currentScopeId: string
  readonly trackScopeId: string | undefined
  readonly mixerScopeId: string | undefined
  readonly assignmentHasEquals: boolean
}

function shouldKeepPreviousSibling (node: SyntaxNode): boolean {
  const type = node.type.name

  return type === 'AccessOrCall' ||
    type === 'Callee' ||
    type === 'Call' ||
    type === 'MemberAccess' ||
    type === 'VariableName' ||
    type === 'BusNamespace'
}

function scopeKey (typeName: string, range: SourceRange): string {
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
