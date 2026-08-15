import type { ast } from '@meyfa/cadence-ast'
import type { Schema, SchemaItem } from '../../type-system/schema.ts'
import { makeSchema } from '../../type-system/schema.ts'
import { CompileError } from '../error.ts'
import type { Binding } from './scopes.ts'
import { checkType } from './type-expressions.ts'

export interface CheckedParameters {
  readonly errors: readonly CompileError[]
  readonly schema: Schema
  readonly bindings: ReadonlyMap<string, Binding>
}

export function checkParameters (expressions: readonly ast.Parameter[]): CheckedParameters {
  const errors: CompileError[] = []

  const items: SchemaItem[] = []
  const bindings = new Map<string, Binding>()

  for (const parameter of expressions) {
    const parameterCheck = checkType(parameter.parameterType)
    errors.push(...parameterCheck.errors)

    if (parameterCheck.result == null) {
      continue
    }

    if (bindings.has(parameter.name.name)) {
      errors.push(new CompileError(`Duplicate parameter name "${parameter.name.name}"`, parameter.name.range))
      continue
    }

    items.push({
      name: parameter.name.name,
      type: parameterCheck.result,
      required: !parameter.optional
    })

    bindings.set(parameter.name.name, {
      name: parameter.name.name,
      type: parameterCheck.result,
      definite: !parameter.optional,
      range: parameter.name.range
    })
  }

  const schema = makeSchema(items)

  return { errors, schema, bindings }
}
