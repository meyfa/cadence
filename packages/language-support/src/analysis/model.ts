import { getStandardModule } from '@language'
import type { SyntaxNode, Tree, TreeCursor } from '@lezer/common'
import type { LRParser } from '@lezer/lr'
import type { SourceRange, TextLike } from '../types.js'
import { textFromString, toSourceRange } from './text.js'

export interface BaseModel {
  readonly rootScopeId: string
  readonly scopes: ReadonlyMap<string, Scope>
  readonly identifiers: readonly Identifier[]
  readonly bindings: readonly Binding[]
  readonly bindingsByName: ReadonlyMap<string, readonly Binding[]>
  readonly bindingsByScope: ReadonlyMap<string, readonly Binding[]>
  readonly imports: readonly ImportStatement[]
}

export interface ReferenceModel {
  readonly identifierBindingMap: ReadonlyMap<Identifier, Binding>
  readonly referenceMap: ReadonlyMap<Binding, readonly Identifier[]>
}

export interface KnownValueModel {
  readonly knownValues: ReadonlyMap<Identifier, KnownValue>
}

export type Model = BaseModel & ReferenceModel & KnownValueModel

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
  readonly kind: IdentifierKind
  readonly scopeId: string
  readonly name: string
  readonly range: SourceRange

  /**
   * For member accesses (e.g. "bar" or "baz" in "foo.bar.baz"),
   * this points to the previous identifier in the access chain.
   */
  readonly previousSibling?: Identifier
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

// known values

export interface KnownValue {
  readonly moduleName: string
  readonly exportName?: string
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

  const baseModel = { rootScopeId, scopes, identifiers, bindings, bindingsByName, bindingsByScope, imports }
  const referenceModel = resolveReferences(baseModel)
  const knownValueModel = resolveKnownValues(baseModel, referenceModel)

  return { ...baseModel, ...referenceModel, ...knownValueModel }
}

export function analyzeSourceWithParser (parser: LRParser, source: string): Model {
  const tree = parser.parse(source)
  return analyzeTree(tree, textFromString(source))
}

export function sameRange (a: SourceRange, b: SourceRange): boolean {
  return a.offset === b.offset && a.length === b.length
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

function resolveReferences (model: BaseModel): ReferenceModel {
  const identifierBindingMap = new Map<Identifier, Binding>()
  const referenceMap = new Map<Binding, Identifier[]>()

  for (const identifier of model.identifiers) {
    const binding = resolveDefinitionBinding(model, identifier)
    if (binding != null) {
      identifierBindingMap.set(identifier, binding)

      const references = referenceMap.get(binding)
      if (references == null) {
        referenceMap.set(binding, [identifier])
        continue
      }

      references.push(identifier)
    }
  }

  return { identifierBindingMap, referenceMap }
}

function resolveDefinitionBinding (model: BaseModel, occurrence: Identifier): Binding | undefined {
  switch (occurrence.kind) {
    case 'PropertyName':
      return undefined

    // Ensure that definitions resolve to themselves
    case 'VariableDefinition':
    case 'UseAlias':
      return findBindingBySpan(model, occurrence.range)

    case 'VariableName':
    case 'Callee':
    case 'MemberAccess':
      return findRegularBinding(model, occurrence)

    default:
      occurrence.kind satisfies never
  }
}

function findBindingBySpan (model: BaseModel, range: SourceRange): Binding | undefined {
  let low = 0
  let high = model.bindings.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const binding = model.bindings[mid]

    if (sameRange(binding.range, range)) {
      return binding
    }

    if (binding.range.offset < range.offset || (binding.range.offset === range.offset && binding.range.length < range.length)) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return undefined
}

function findRegularBinding (model: BaseModel, occurrence: Identifier): Binding | undefined {
  if (isExplicitBusReference(occurrence)) {
    return findExplicitBusBinding(model, occurrence.name)
  }

  if (occurrence.previousSibling != null) {
    return undefined
  }

  if (model.imports.some((statement) => statement.alias === occurrence.name)) {
    return model.bindingsByName.get(occurrence.name)?.find((binding) => binding.kind === 'use-alias')
  }

  let scopeId: string | undefined = occurrence.scopeId

  while (scopeId != null) {
    const scoped = model.bindingsByScope.get(scopeId) ?? []

    const binding = scoped.find((binding) => binding.name === occurrence.name)
    if (binding != null) {
      return binding
    }

    const scope = model.scopes.get(scopeId)
    scopeId = scope?.parentId
  }

  return undefined
}

function isExplicitBusReference (identifier: Identifier): boolean {
  return identifier.previousSibling != null &&
    identifier.previousSibling.name === 'bus' &&
    identifier.previousSibling.previousSibling == null
}

function findExplicitBusBinding (model: BaseModel, busName: string): Binding | undefined {
  const busBindings = model.bindingsByName.get(busName) ?? []
  return busBindings.find((binding) => binding.kind === 'bus')
}

function resolveKnownValues (baseModel: BaseModel, referenceModel: ReferenceModel): KnownValueModel {
  const knownValues = new Map<Identifier, KnownValue>()

  for (const identifier of baseModel.identifiers) {
    const value = resolveKnownValue(baseModel, referenceModel, identifier)
    if (value != null) {
      knownValues.set(identifier, value)
    }
  }

  return { knownValues }
}

function resolveKnownValue (baseModel: BaseModel, referenceModel: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  if (identifier.kind === 'PropertyName') {
    return undefined
  }

  if (identifier.previousSibling == null) {
    // resolving "foo" in "foo.bar.baz" -> either a module or default-imported value
    return resolveKnownValueForIdentifier(baseModel, referenceModel, identifier)
  }

  if (identifier.previousSibling.previousSibling == null) {
    // resolving "bar" in "foo.bar.baz" -> could be an export of the module aliased as "foo"
    return resolveKnownValueWithMember(baseModel, referenceModel, identifier.previousSibling, identifier)
  }

  // resolving "baz" in "foo.bar.baz" -> not known (modules don't have nested members)
  return undefined
}

function resolveKnownValueForIdentifier (baseModel: BaseModel, referenceModel: ReferenceModel, identifier: Identifier): KnownValue | undefined {
  const binding = referenceModel.identifierBindingMap.get(identifier)

  switch (binding?.kind) {
    case undefined:
      return resolveKnownValueForDefaultImport(baseModel, identifier)

    case 'use-alias': {
      const moduleName = findModuleNameForBinding(baseModel, binding)
      return moduleName != null ? { moduleName } : undefined
    }

    default:
      return undefined
  }
}

function resolveKnownValueWithMember (baseModel: BaseModel, referenceModel: ReferenceModel, object: Identifier, property: Identifier): KnownValue | undefined {
  const binding = referenceModel.identifierBindingMap.get(object)
  if (binding == null || binding.kind !== 'use-alias') {
    return undefined
  }

  const moduleName = findModuleNameForBinding(baseModel, binding)
  return moduleName != null ? { moduleName, exportName: property.name } : undefined
}

function resolveKnownValueForDefaultImport (baseModel: BaseModel, identifier: Identifier): KnownValue | undefined {
  for (const { alias, moduleName } of baseModel.imports) {
    // Must not have an alias (i.e. be a default import)
    if (alias == null && getStandardModule(moduleName)?.exports.has(identifier.name)) {
      return { moduleName, exportName: identifier.name }
    }
  }

  return undefined
}

function findModuleNameForBinding (model: BaseModel, binding: Binding): string | undefined {
  if (binding.kind !== 'use-alias') {
    return undefined
  }

  const importStatement = model.imports.find((statement) =>
    statement.alias != null &&
    statement.alias === binding.name &&
    statement.aliasRange != null &&
    sameRange(statement.aliasRange, binding.range)
  )

  return importStatement?.moduleName
}
