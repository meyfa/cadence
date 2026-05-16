import type { Brand } from '@utility'
import type { SourceRange } from '../utilities/range.js'

export type Model = BaseModel & ReferenceModel & KnownValueModel

export interface BaseModel {
  readonly rootScopeId: ScopeId
  readonly scopes: readonly Scope[]
  readonly identifiers: readonly Identifier[]
  readonly bindings: readonly Binding[]
  readonly imports: readonly Import[]
}

export interface ReferenceModel {
  readonly identifierBindingMap: ReadonlyMap<IdentifierId, Binding>
  readonly referenceMap: ReadonlyMap<BindingId, readonly Identifier[]>
}

export interface KnownValueModel {
  readonly knownValues: ReadonlyMap<IdentifierId, KnownValue>
}

// scope

export type ScopeId = Brand<string, 'language-support.ScopeId'>

export interface Scope {
  readonly id: ScopeId
  readonly kind: ScopeKind
  readonly parentId?: string
  readonly range: SourceRange
}

export type ScopeKind = 'root' | 'track' | 'mixer'

// identifier

export type IdentifierId = Brand<string, 'language-support.IdentifierId'>

export interface Identifier {
  readonly id: IdentifierId
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

export type IdentifierKind = 'plain' | 'definition' | 'property-name'

// binding

export type BindingId = Brand<string, 'language-support.BindingId'>

export interface Binding {
  readonly id: BindingId
  readonly kind: BindingKind
  readonly scopeId: string
  readonly name: string
  readonly range: SourceRange

  /**
   * For use-aliases, this is the module that is being imported.
   */
  readonly moduleName?: string
}

export type BindingKind = 'regular' | 'use-alias' | 'part' | 'bus'

// import

export type ImportId = Brand<string, 'language-support.ImportId'>

export interface Import {
  readonly id: ImportId
  readonly moduleName: string
  readonly range: SourceRange
  readonly alias?: string
  readonly aliasRange?: SourceRange
}

// known values

export interface KnownValue {
  readonly moduleName: string
  readonly exportName?: string
}
