import type { ast, SourceRange } from '@meyfa/cadence-ast'
import type { Capabilities, FunctionSpec } from '../../type-system/base/function.ts'
import type { Type } from '../../type-system/types.ts'

export interface Scope {
  readonly top: GlobalScope
  readonly parent?: Scope
  readonly resolutions: ReadonlyMap<string, Binding>
  readonly allowedCapabilities: Capabilities
}

export interface GlobalScope extends Scope {
  readonly semantic: {
    readonly functions: Map<ast.Function, FunctionSpec>
  }
}

export interface MutableScope extends Scope {
  readonly resolutions: Map<string, Binding>
}

export interface Binding {
  readonly name: string
  readonly type: Type
  readonly definite: boolean
  readonly range?: SourceRange
}

export function createGlobalScope (initialResolutions: ReadonlyMap<string, Binding>): GlobalScope {
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
