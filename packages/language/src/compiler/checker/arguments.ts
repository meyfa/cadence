import type { ast, SourceRange } from '@meyfa/cadence-ast'
import type { Capabilities } from '../../type-system/base/function.ts'
import type { Schema, SchemaItem } from '../../type-system/schema.ts'
import type { FacetType } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import { checkExpression } from './expressions.ts'
import type { Scope } from './scopes.ts'

export interface CheckedArguments {
  readonly errors: readonly CompileError[]
  readonly capabilities: Capabilities
  readonly types: ReadonlyMap<string, FacetType>
  readonly ranges: ReadonlyMap<string, SourceRange>
}

export function checkArguments (
  scope: Scope,
  args: readonly ast.Argument[],
  schema: Schema,
  range: SourceRange
): CheckedArguments {
  const errors: CompileError[] = []
  let capabilities = noCapabilities
  const types = new Map<string, FacetType>()
  const ranges = new Map<string, SourceRange>()

  const seen = new Set<string>()
  let namedStarted = false

  for (let index = 0; index < args.length; ++index) {
    const arg = args[index]

    let spec: SchemaItem | undefined

    if (arg.name != null || namedStarted) {
      namedStarted = true

      if (arg.name == null) {
        errors.push(new CompileError(`Unexpected positional argument after named arguments`, arg.range))
        continue
      }

      spec = schema.byName.get(arg.name.name)
      if (spec == null) {
        errors.push(new CompileError(`Unknown argument "${arg.name.name}"`, arg.name.range))
        continue
      }

      if (seen.has(spec.name)) {
        errors.push(new CompileError(`Duplicate argument named "${arg.name.name}"`, arg.name.range))
        continue
      }
    } else {
      spec = schema.items.at(index)
      if (spec == null) {
        errors.push(new CompileError(`Unknown positional argument`, arg.range))
        continue
      }
    }

    seen.add(spec.name)

    const expressionCheck = checkExpression(scope, arg.value)
    errors.push(...expressionCheck.errors)
    capabilities = mergeCapabilities(capabilities, expressionCheck.capabilities)

    if (expressionCheck.result != null) {
      if (!spec.type.is(expressionCheck.result)) {
        errors.push(new CompileError(`Expected type ${spec.type.format()} for argument "${spec.name}", got ${expressionCheck.result.format()}`, arg.value.range))
      } else {
        types.set(spec.name, expressionCheck.result)
        ranges.set(spec.name, arg.value.range)
      }
    }
  }

  for (const spec of schema.items) {
    if (spec.required && !seen.has(spec.name)) {
      errors.push(new CompileError(`Missing required argument "${spec.name}"`, range))
    }
  }

  return { errors, capabilities, types, ranges }
}
