import { parseStringLiteral } from '@meyfa/cadence-language'
import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { SourceRange } from '../../utilities/range.ts'
import type { TextLike } from '../../utilities/text.ts'
import { toSourceRange } from '../../utilities/text.ts'
import type { BaseModel, Binding, BindingId, BindingKind, Identifier, IdentifierId, IdentifierKind, Import, ImportId, Scope, ScopeId, ScopeKind } from '../model.ts'

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

    addIdentifier({ kind: 'definition', scopeId: input.scopeId, name: input.name, range: input.range })

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
    pendingScope: Scope | undefined,
    assignmentHasEquals: boolean,
    previousSibling?: Identifier
  ): Identifier | undefined => {
    const typeName = cursor.type.name
    const from = cursor.from
    const to = cursor.to

    const range = toSourceRange(document, from, to)

    const nextParentType = typeName

    let nextScopeId = scopeId
    let nextPendingScope = pendingScope
    let nextAssignmentHasEquals = assignmentHasEquals
    let accessChainTail: Identifier | undefined

    switch (typeName) {
      case 'Import': {
        const statement = parseImport(document, cursor.node)
        if (statement == null) {
          break
        }

        const { alias, aliasRange, moduleName } = statement
        if (alias != null) {
          addBinding({ kind: 'use-alias', scopeId, name: alias, range: aliasRange, moduleName })
        }

        addImport(statement)

        break
      }

      case 'TrackBlock': {
        const scope = addScope({ kind: 'track', range, parentId: scopeId })
        nextScopeId = scope.id
        break
      }

      case 'PartBlock': {
        const scope = addScope({ kind: 'part', range, parentId: scopeId })
        nextScopeId = scope.id
        break
      }

      case 'MixerBlock': {
        const scope = addScope({ kind: 'mixer', range, parentId: scopeId })
        nextScopeId = scope.id
        break
      }

      case 'Bus': {
        const block = cursor.node.getChild('BusBlock')
        if (block != null) {
          const blockRange = toSourceRange(document, block.from, block.to)
          nextPendingScope = addScope({ kind: 'bus', range: blockRange, parentId: scopeId })
        }
        break
      }

      case 'BusBlock': {
        if (pendingScope?.kind === 'bus') {
          nextScopeId = pendingScope.id
          nextPendingScope = undefined
        }
        break
      }

      case 'InstrumentBlock': {
        const scope = addScope({ kind: 'instrument', range, parentId: scopeId })
        nextScopeId = scope.id
        break
      }

      case 'Voice': {
        const scope = addScope({ kind: 'voice', range, parentId: scopeId })
        nextScopeId = scope.id
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
        const { name, range: nameRange } = getVariableName(document, from, to)

        switch (parentType) {
          case 'Assignment': {
            if (assignmentHasEquals) {
              addBinding({ kind: 'regular', scopeId, name, range: nameRange })
              break
            }
            // Invalid/incomplete syntax encountered.
            // We still add an identifier as a best-effort approach to provide some level of functionality.
            accessChainTail = addIdentifier({ kind: 'plain', scopeId, name, range: nameRange, previousSibling })
            break
          }

          case 'Part': {
            addBinding({ kind: 'part', scopeId, name, range: nameRange })
            break
          }

          case 'Bus': {
            if (pendingScope?.kind === 'bus') {
              addBinding({ kind: 'bus', scopeId, name, range: nameRange, declaredScopeId: pendingScope.id })
            }
            break
          }

          case 'EffectStatement': {
            addBinding({ kind: 'effect', scopeId, name, range: nameRange })
            break
          }

          case 'Voice': {
            addBinding({ kind: 'regular', scopeId, name, range: nameRange })
            break
          }
        }
        break
      }

      case 'PropertyName': {
        const name = document.sliceString(from, to)
        addIdentifier({ kind: 'property-name', scopeId, name, range })
        break
      }

      case 'VariableName':
      case 'Callee':
      case 'Member':
      case 'BusNamespace': {
        const { name, range: nameRange } = getVariableName(document, from, to)
        accessChainTail = addIdentifier({ kind: 'plain', scopeId, name, range: nameRange, previousSibling })
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
          nextPendingScope,
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

  walk(cursor, undefined, rootScopeId, undefined, false)

  sortByOffset(scopes)
  sortByOffset(identifiers)
  sortByOffset(bindings)
  sortByOffset(imports)

  return { rootScopeId, scopes, identifiers, bindings, imports }
}

function getVariableName (document: TextLike, from: number, to: number): Readonly<{ name: string, range: SourceRange }> {
  // The parser can produce nodes with trailing whitespace (possibly a bug).
  // Example (emits "kick " with a trailing space):
  //     track { part { kick } }
  const rawName = document.sliceString(from, to)
  const name = rawName.trimEnd()
  const range = toSourceRange(document, from, from + name.length)

  return { name, range }
}

function sortByOffset (items: Array<{ readonly range: SourceRange }>): void {
  items.sort((a, b) => a.range.offset - b.range.offset)
}

function shouldKeepPreviousSibling (node: SyntaxNode): boolean {
  const type = node.type.name

  return type === 'AccessOrCall' ||
    type === 'Callee' ||
    type === 'Call' ||
    type === 'Member' ||
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

function parseImport (document: TextLike, node: SyntaxNode): Omit<Import, 'id'> | undefined {
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

  if (moduleName == null || alias == null || aliasRange == null) {
    return undefined
  }

  const range = toSourceRange(document, node.from, node.to)

  const result = { moduleName, range, aliasRange }
  if (alias === '*') {
    return result
  }

  return { ...result, alias }
}
