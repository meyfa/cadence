import type { ast } from '@meyfa/cadence-ast'
import type { Schema, SchemaItem } from '../../type-system/schema.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { FacetType } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { checkType } from './type-expressions.ts'

export interface CheckedParameters {
  readonly errors: readonly CompileError[]
  readonly types: ReadonlyMap<string, FacetType>
  readonly schema: Schema
}

export function checkParameters (expressions: readonly ast.Parameter[]): CheckedParameters {
  const errors: CompileError[] = []

  const types = new Map<string, FacetType>()
  const items: SchemaItem[] = []

  for (const parameter of expressions) {
    const parameterCheck = checkType(parameter.parameterType)
    errors.push(...parameterCheck.errors)

    if (parameterCheck.result == null) {
      continue
    }

    if (types.has(parameter.name.name)) {
      errors.push(new CompileError(`Duplicate parameter name "${parameter.name.name}"`, parameter.name.range))
      continue
    }

    types.set(parameter.name.name, parameterCheck.result)
    items.push({
      name: parameter.name.name,
      type: parameterCheck.result,
      required: true
    })
  }

  const schema = makeSchema(items)

  return { errors, types, schema }
}
