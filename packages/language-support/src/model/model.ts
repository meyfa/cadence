import type { SourceRange } from '../utilities/range.js'

export type Model = BaseModel & ReferenceModel & KnownValueModel

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
