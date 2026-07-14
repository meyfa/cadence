import type { Effects } from '../../type-system/base/function.ts'
import type { FacetType } from '../../type-system/types.ts'

// scope types

export interface Scope {
  readonly top: GlobalScope
  readonly parent?: Scope
  readonly resolutions: ReadonlyMap<string, FacetType>
  readonly allowedEffects: Effects
}

export interface GlobalScope extends Scope {
  readonly buses: Map<string, FacetType>
  readonly namespaces: Map<string, MutableNamespace>
}

export interface MutableScope extends Scope {
  readonly resolutions: Map<string, FacetType>
}

// namespace

export interface Namespace {
  readonly resolutions: ReadonlyMap<string, FacetType>
}

export interface MutableNamespace extends Namespace {
  readonly resolutions: Map<string, FacetType>
}

// factory functions

export function createGlobalScope (initialResolutions: ReadonlyMap<string, FacetType>): GlobalScope {
  const scope = {
    // from Scope
    get top (): GlobalScope {
      return scope
    },

    resolutions: new Map(initialResolutions),

    allowedEffects: {
      blocking: true
    },

    // from GlobalScope
    namespaces: new Map(),
    buses: new Map()
  }

  return scope
}

export function createLocalScope (parent: Scope, overrideEffects?: Effects): MutableScope {
  return {
    top: parent.top,
    parent,
    resolutions: new Map(),
    allowedEffects: overrideEffects ?? parent.allowedEffects
  }
}

export function createNamespace (): MutableNamespace {
  return {
    resolutions: new Map()
  }
}
