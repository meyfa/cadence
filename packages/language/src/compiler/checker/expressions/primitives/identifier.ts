import { ast } from '@meyfa/cadence-ast'
import type { Type } from '../../../../type-system/types.ts'
import { CompileError } from '../../../error.ts'
import { resolveInScope } from '../../../resolution.ts'
import { noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import type { Checked } from '../types.ts'

export function checkIdentifier (scope: Scope, expression: ast.Identifier): Checked<Type> {
  const errors: CompileError[] = []
  const capabilities = noCapabilities

  const binding = resolveInScope(scope, expression.name)
  if (binding == null) {
    errors.push(new CompileError(`Unknown identifier "${expression.name}"`, expression.range))
    return { errors, capabilities }
  }

  if (!binding.definite) {
    errors.push(new CompileError(`Identifier "${expression.name}" is not definitely assigned`, expression.range))
    return { errors, capabilities }
  }

  const result = binding.type

  return { errors, capabilities, result }
}
