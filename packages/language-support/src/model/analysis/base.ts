import { parseStringLiteral } from '@meyfa/cadence-language'
import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { SourceRange } from '../../utilities/range.ts'
import type { TextLike } from '../../utilities/text.ts'
import { toSourceRange } from '../../utilities/text.ts'
import type { BaseModel, Binding, BindingId, BindingKind, Identifier, IdentifierId, IdentifierKind, Import, ImportId, Scope, ScopeId } from '../model.ts'

export function computeBaseModel (tree: Tree, document: TextLike): BaseModel {
  const scopes: Scope[] = []
  const identifiers: Identifier[] = []
  const bindings: Binding[] = []
  const imports: Import[] = []

  const addScope = (input: Omit<Scope, 'id'>): Scope => {
    const scope = { ...input, id: scopeKey(input.node, input.range) }
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

  // A variable assigned in every reachable branch of a conditional is visible afterward,
  // even though each assignment's own binding remains scoped to its own branch.
  const mergeConditionalBindings = (parentScopeId: string, branchScopeIds: readonly string[], endOffset: number): void => {
    const groups = new Map<string, Binding[]>()

    for (const binding of bindings) {
      if (binding.kind !== 'regular' || !branchScopeIds.includes(binding.scopeId)) {
        continue
      }

      const group = groups.get(binding.name)
      if (group == null) {
        groups.set(binding.name, [binding])
        continue
      }

      group.push(binding)
    }

    for (const [name, group] of groups) {
      const firstDefinition = group.reduce((earliest, binding) => binding.range.offset < earliest.range.offset ? binding : earliest)

      bindings.push({
        id: conditionalBindingKey(parentScopeId, endOffset, name),
        kind: 'regular',
        scopeId: parentScopeId,
        name,
        range: firstDefinition.range,
        visibilityStartOffset: endOffset,
        mergedFrom: group.map((binding) => binding.id)
      })
    }
  }

  const cursor = tree.cursor()

  const walk = (
    cursor: TreeCursor,
    parentType: string | undefined,
    scopeId: string,
    assignmentHasEquals: boolean,
    assignmentIsExposed: boolean,
    previousSibling?: Identifier
  ): Identifier | undefined => {
    const typeName = cursor.type.name
    const from = cursor.from
    const to = cursor.to

    const range = toSourceRange(document, from, to)

    const nextParentType = typeName

    let nextScopeId = scopeId
    let nextAssignmentHasEquals = assignmentHasEquals
    let nextAssignmentIsExposed = assignmentIsExposed
    let accessChainTail: Identifier | undefined
    let deferredBinding: Omit<Binding, 'id'> | undefined
    let conditionalBranchScopeIds: string[] | undefined

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

      case 'Block':
      case 'Function':
      case 'Voice': {
        const scope = addScope({ node: typeName, range, parentId: scopeId })
        nextScopeId = scope.id
        break
      }

      case 'IfStatement': {
        conditionalBranchScopeIds = cursor.node.getChildren('Block')
          .map((block) => scopeKey('Block', toSourceRange(document, block.from, block.to)))
        break
      }

      case 'Assignment': {
        const { hasEquals, isExposed, variable } = parseAssignment(document, cursor.node)
        nextAssignmentHasEquals = hasEquals
        nextAssignmentIsExposed = isExposed

        if (hasEquals && variable != null) {
          // The binding cannot be referred to from the assignment's right-hand side.
          deferredBinding = {
            kind: 'regular',
            scopeId,
            name: variable.name,
            range: variable.range,
            isExposed,
            visibilityStartOffset: to
          }
        }

        break
      }

      case 'VariableDefinition': {
        const { name, range: nameRange } = getVariableName(document, from, to)

        switch (parentType) {
          case 'Assignment': {
            if (assignmentHasEquals) {
              // Handled via deferredBinding in the Assignment case above.
              break
            }
            // Invalid/incomplete syntax encountered.
            // We still add an identifier as a best-effort approach to provide some level of functionality.
            accessChainTail = addIdentifier({ kind: 'plain', scopeId, name, range: nameRange, previousSibling })
            break
          }

          case 'Function':
          case 'Voice': {
            addBinding({ kind: 'regular', scopeId, name, range: nameRange })
            break
          }
        }
        break
      }

      case 'ArgumentName': {
        const name = document.sliceString(from, to)
        addIdentifier({ kind: 'argument', scopeId, name, range })
        break
      }

      case 'VariableName':
      case 'Callee':
      case 'Member': {
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
          nextAssignmentHasEquals,
          nextAssignmentIsExposed,
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

    if (deferredBinding != null) {
      addBinding(deferredBinding)
    }

    if (typeName === 'IfStatement' && conditionalBranchScopeIds != null) {
      mergeConditionalBindings(scopeId, conditionalBranchScopeIds, to)
    }

    return accessChainTail
  }

  const { id: rootScopeId } = addScope({
    node: tree.topNode.name,
    range: toSourceRange(document, 0, document.length)
  })

  walk(cursor, undefined, rootScopeId, false, false)

  sortByOffset(scopes)
  sortByOffset(identifiers)
  sortByOffset(bindings)
  sortByOffset(imports)

  return { rootScopeId, scopes, identifiers, bindings, imports }
}

interface VariableName {
  readonly name: string
  readonly range: SourceRange
}

function getVariableName (document: TextLike, from: number, to: number): VariableName {
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
    type === 'VariableName'
}

function scopeKey (node: string, range: SourceRange): ScopeId {
  return `${node}:${range.offset}:${range.length}` as ScopeId
}

function identifierKey (kind: IdentifierKind, scopeId: string, range: SourceRange): IdentifierId {
  return `${kind}:${scopeId}:${range.offset}:${range.length}` as IdentifierId
}

function bindingKey (kind: BindingKind, scopeId: string, range: SourceRange): BindingId {
  return `${kind}:${scopeId}:${range.offset}:${range.length}` as BindingId
}

function conditionalBindingKey (scopeId: string, endOffset: number, name: string): BindingId {
  return `merge:${scopeId}:${endOffset}:${name}` as BindingId
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

interface AssignmentParseResult {
  readonly hasEquals: boolean
  readonly isExposed: boolean
  readonly variable?: VariableName
}

function parseAssignment (document: TextLike, node: SyntaxNode): AssignmentParseResult {
  let hasEquals = false
  let isExposed = false
  let variable: VariableName | undefined

  const cursor = node.cursor()

  if (cursor.firstChild()) {
    do {
      switch (cursor.type.name) {
        case 'VariableDefinition':
          variable = getVariableName(document, cursor.from, cursor.to)
          break
        case '=':
          hasEquals = true
          break
        case '@':
          isExposed = true
          break
      }
    } while (cursor.nextSibling())
  }

  return { hasEquals, isExposed, variable }
}
