import type { SourceRange } from '../../utilities/range.ts'
import type { ImportId, ScopeId, IdentifierKind, IdentifierId, BindingKind, BindingId } from '../model.ts'

export function importKey (moduleName: string, range: SourceRange): ImportId {
  return `${moduleName}:${range.offset}:${range.length}` as ImportId
}

export function scopeKey (node: string, range: SourceRange): ScopeId {
  return `${node}:${range.offset}:${range.length}` as ScopeId
}

export function identifierKey (kind: IdentifierKind, scopeId: string, range: SourceRange): IdentifierId {
  return `${kind}:${scopeId}:${range.offset}:${range.length}` as IdentifierId
}

export function bindingKey (kind: BindingKind, scopeId: string, range: SourceRange): BindingId {
  return `${kind}:${scopeId}:${range.offset}:${range.length}` as BindingId
}

export function conditionalBindingKey (scopeId: string, endOffset: number, name: string): BindingId {
  return `merge:${scopeId}:${endOffset}:${name}` as BindingId
}
