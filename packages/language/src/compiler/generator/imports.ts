import { ast } from '@meyfa/cadence-ast'
import { setAll } from '@meyfa/cadence-utility'
import { getStandardModuleValue } from '../../library/modules.ts'
import { ModuleFacet } from '../../type-system/base/module.ts'
import type { Value } from '../../type-system/types.ts'
import { assert, nonNull } from '../assert.ts'

export function processImports (imports: readonly ast.Import[]): ReadonlyMap<string, Value> {
  const getModule = (library: ast.String) => {
    assert(library.parts.every((part) => typeof part === 'string'))
    const module = getStandardModuleValue(library.parts.join(''))
    return nonNull(module)
  }

  const result = new Map<string, Value>()

  // Process default imports first, such that aliases can override them

  for (const statement of imports) {
    if (statement.alias == null) {
      const { exports } = ModuleFacet.get(getModule(statement.library))
      setAll(result, exports)
    }
  }

  for (const statement of imports) {
    if (statement.alias != null) {
      result.set(statement.alias, getModule(statement.library))
    }
  }

  return result
}
