import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import { parseStringLiteral } from '@language'
import type { SourceRange } from '../../utilities/range.js'
import type { TextLike } from '../../utilities/text.js'
import { toSourceRange } from '../../utilities/text.js'
import type { BaseModel, Binding, BindingId, BindingKind, Identifier, IdentifierId, IdentifierKind, Import, ImportId, Scope, ScopeId, ScopeKind } from '../model.js'

export function computeBaseModel (tree: Tree, document: TextLike): BaseModel {
  const rootRange = toSourceRange(document, 0, document.length)

  const rootScopeId = scopeKey('root', rootRange)

  const scopes: Scope[] = [{ id: rootScopeId, kind: 'root', range: rootRange }]
  const identifiers: Identifier[] = []
  const bindings: Binding[] = []
  const imports: Import[] = []

  const addScope = (input: Omit<Scope, 'id'>): Scope => {
    const scope = { ...input, id: scopeKey(input.kind, input.range) }
    scopes.push(scope)
    return scope
  }

  const addIdentifier = (input: Omit<Identifier, 'id'>): Identifier => {
    const identifier = { ...input, id: identifierKey(input.kind, input.scopeId, input.range) }
    identifiers.push(identifier)
    return identifier
  }

  const addBinding = (input: Omit<Binding, 'id'>): Binding => {
    const binding = { ...input, id: bindingKey(input.kind, input.scopeId, input.range) }
    bindings.push(binding)
    return binding
  }

  const addImport = (input: Omit<Import, 'id'>): Import => {
    const statement = { ...input, id: importKey(input.moduleName, input.range) }
    imports.push(statement)
    return statement
  }

  const cursor = tree.cursor()

  const walk = (
    cursor: TreeCursor,
    parentType: string | undefined,
    scopeId: string,
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

    let nextScopeId = scopeId
    let nextTrackScopeId = trackScopeId
    let nextMixerScopeId = mixerScopeId
    let nextAssignmentHasEquals = assignmentHasEquals
    let accessChainTail: Identifier | undefined

    switch (typeName) {
      case 'UseStatement': {
        const statement = parseUseStatement(document, cursor.node)
        if (statement == null) {
          break
        }

        const { alias, aliasRange, moduleName } = statement
        if (alias != null && aliasRange != null) {
          addIdentifier({ kind: 'definition', scopeId, name: alias, range: aliasRange })
          addBinding({ kind: 'use-alias', scopeId, name: alias, range: aliasRange, moduleName })
        }

        addImport(statement)

        break
      }

      case 'TrackStatement': {
        const scope = addScope({ kind: 'track', range, parentId: scopeId })
        nextScopeId = scope.id
        nextTrackScopeId = scope.id
        break
      }

      case 'MixerStatement': {
        const scope = addScope({ kind: 'mixer', range, parentId: scopeId })
        nextScopeId = scope.id
        nextMixerScopeId = scope.id
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
          scopeId,
          trackScopeId: nextTrackScopeId,
          mixerScopeId: nextMixerScopeId,
          assignmentHasEquals: nextAssignmentHasEquals
        })

        if (binding == null) {
          // Invalid/incomplete syntax encountered.
          // We still add an identifier as a best-effort approach to provide some level of functionality.
          accessChainTail = addIdentifier({ kind: 'plain', scopeId, name, range, previousSibling })
          break
        }

        addIdentifier({ kind: 'definition', scopeId, name, range })
        addBinding({ ...binding, name, range })

        break
      }

      case 'PropertyName': {
        const name = document.sliceString(from, to)
        addIdentifier({ kind: 'property-name', scopeId, name, range })
        break
      }

      case 'VariableName':
      case 'Callee':
      case 'MemberAccess':
      case 'BusNamespace': {
        const name = document.sliceString(from, to)
        accessChainTail = addIdentifier({ kind: 'plain', scopeId, name, range, previousSibling })
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

  sortByOffset(scopes)
  sortByOffset(identifiers)
  sortByOffset(bindings)
  sortByOffset(imports)

  return { rootScopeId, scopes, identifiers, bindings, imports }
}

function sortByOffset (items: Array<{ readonly range: SourceRange }>): void {
  items.sort((a, b) => a.range.offset - b.range.offset)
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

function scopeKey (kind: ScopeKind, range: SourceRange): ScopeId {
  return `${kind}:${range.offset}:${range.length}` as ScopeId
}

function identifierKey (kind: IdentifierKind, scopeId: string, range: SourceRange): IdentifierId {
  return `${kind}:${scopeId}:${range.offset}:${range.length}` as IdentifierId
}

function bindingKey (kind: BindingKind, scopeId: string, range: SourceRange): BindingId {
  return `${kind}:${scopeId}:${range.offset}:${range.length}` as BindingId
}

function importKey (moduleName: string, range: SourceRange): ImportId {
  return `${moduleName}:${range.offset}:${range.length}` as ImportId
}

interface DefinitionBindingContext {
  readonly parentType: string | undefined
  readonly scopeId: string
  readonly trackScopeId: string | undefined
  readonly mixerScopeId: string | undefined
  readonly assignmentHasEquals: boolean
}

function getDefinitionBinding (context: DefinitionBindingContext): Omit<Binding, 'id' | 'name' | 'range'> | undefined {
  switch (context.parentType) {
    case 'Assignment':
      return context.assignmentHasEquals
        ? { kind: 'regular', scopeId: context.scopeId }
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

function parseUseStatement (document: TextLike, node: SyntaxNode): Omit<Import, 'id'> | undefined {
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

  const result = { moduleName, range: toSourceRange(document, node.from, node.to) }
  if (alias === '*') {
    return result
  }

  return { ...result, alias, aliasRange }
}
