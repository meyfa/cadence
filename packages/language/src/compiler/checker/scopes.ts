import { ast } from '@meyfa/cadence-ast'
import type { Capabilities, FunctionSpec } from '../../type-system/base/function.ts'
import type { FacetType } from '../../type-system/types.ts'

// scope types

export interface Scope {
  readonly top: GlobalScope
  readonly parent?: Scope
  readonly resolutions: ReadonlyMap<string, FacetType>
  readonly allowedCapabilities: Capabilities
}

export interface GlobalScope extends Scope {
  readonly semantic: {
    readonly functions: Map<ast.Function, FunctionSpec>
  }
}

export interface MutableScope extends Scope {
  readonly resolutions: Map<string, FacetType>
}

// factory functions

export function createGlobalScope (initialResolutions: ReadonlyMap<string, FacetType>): GlobalScope {
  const scope: GlobalScope = {
    // from Scope
    get top (): GlobalScope {
      return scope
    },

    resolutions: new Map(initialResolutions),

    allowedCapabilities: {
      mayBlock: true
    },

    // from GlobalScope
    semantic: {
      functions: new Map()
    }
  }

  return scope
}

export function createLocalScope (parent: Scope, overrideCapabilities?: Capabilities): MutableScope {
  return {
    top: parent.top,
    parent,
    resolutions: new Map(),
    allowedCapabilities: overrideCapabilities ?? parent.allowedCapabilities
  }
}
