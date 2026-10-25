import { ast } from '@meyfa/cadence-ast'
import type { InferSchema, Schema } from '../../../type-system/schema.ts'
import type { Value } from '../../../type-system/types.ts'
import { assert, nonNull } from '../../assert.ts'
import { resolve } from './index.ts'
import type { Scope } from '../scopes.ts'

export function resolveArgumentList<S extends Schema> (scope: Scope, args: readonly ast.Argument[], schema: S): InferSchema<S> {
  const entries: Array<[string, Value]> = []

  // positionals
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    if (arg.name != null) {
      break
    }

    const { name } = nonNull(schema.items.at(i))
    entries.push([name, resolve(scope, arg.value)])
  }

  // named
  for (let i = entries.length; i < args.length; ++i) {
    const arg = args[i]
    assert(arg.name != null && schema.byName.has(arg.name.name))
    entries.push([arg.name.name, resolve(scope, arg.value)])
  }

  return Object.fromEntries(entries) as InferSchema<S>
}
