import assert from 'node:assert'
import type { FunctionContext } from '../../../src/compiler/functions.js'
import type { Function } from '../../../src/type-system/base/function.js'
import { FunctionFacet } from '../../../src/type-system/base/function.js'
import { ModuleFacet } from '../../../src/type-system/base/module.js'
import type { Schema } from '../../../src/type-system/schema.js'
import type { FacetType, Value } from '../../../src/type-system/types.js'

export function getModuleExport (moduleValue: Value, exportName: string): Value {
  const module = ModuleFacet.get(moduleValue)

  const exportValue = module.exports.get(exportName)
  assert.ok(exportValue != null, `Module '${module.name}' does not export '${exportName}'`)

  return exportValue
}

export function getFunctionExport (moduleValue: Value, exportName: string): Function<Schema, FacetType, FunctionContext> {
  const exportValue = getModuleExport(moduleValue, exportName)
  assert.ok(FunctionFacet.has(exportValue), `Export '${exportName}' is not a function`)

  // cast due to context type
  return FunctionFacet.get(exportValue) as Function<Schema, FacetType, FunctionContext>
}
