import { ast } from '@meyfa/cadence-ast'
import { FunctionFacet } from '../../../../type-system/base/function.ts'
import type { FacetType, Type } from '../../../../type-system/types.ts'
import { CompileError } from '../../../error.ts'
import { mergeCapabilities, noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import { checkArguments } from '../arguments.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'
import { liftOverFacetType } from '../utilities.ts'

export function checkCall (scope: Scope, expression: ast.Call): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const calleeCheck = checkExpression(scope, expression.callee)
  errors.push(...calleeCheck.errors)
  capabilities = mergeCapabilities(capabilities, calleeCheck.capabilities)

  if (calleeCheck.result == null) {
    return { errors, capabilities }
  }

  const callee = calleeCheck.result
  if (!FunctionFacet.is(calleeCheck.result)) {
    errors.push(new CompileError(`Cannot call value of type ${callee.format()}`, expression.range))
    return { errors, capabilities }
  }

  const lifted = liftOverFacetType(callee, (facetType) => {
    return checkCallWithCalleeAtom(scope, expression, facetType)
  })
  errors.push(...lifted.errors)
  capabilities = mergeCapabilities(capabilities, lifted.capabilities)

  return { errors, capabilities, result: lifted.result }
}

function checkCallWithCalleeAtom (
  scope: Scope,
  expression: ast.Call,
  callee: FacetType
): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const {
    parameters,
    returnType,
    capabilities: functionCapabilities,
    check: checkParameters
  } = FunctionFacet.detail(callee)

  capabilities = mergeCapabilities(capabilities, functionCapabilities)

  if (!scope.allowedCapabilities.mayBlock && functionCapabilities.mayBlock) {
    const functionName = tryGetFunctionName(expression.callee)
    const message = functionName != null
      ? `Function "${functionName}" may block and cannot be called from a realtime context`
      : `Function may block and cannot be called from a realtime context`
    errors.push(new CompileError(message, expression.range))
  }

  const argumentListCheck = checkArguments(scope, expression.arguments, parameters, expression.range)
  errors.push(...argumentListCheck.errors)
  capabilities = mergeCapabilities(capabilities, argumentListCheck.capabilities)

  if (checkParameters != null) {
    const parameterErrors = checkParameters(argumentListCheck.types)
    for (const { parameter, message } of parameterErrors) {
      const range = argumentListCheck.ranges.get(parameter)
      errors.push(new CompileError(message, range))
    }
  }

  return { errors, capabilities, result: returnType }
}

function tryGetFunctionName (callee: ast.Expression): string | undefined {
  if (callee.type === 'Identifier') {
    return callee.name
  }

  if (callee.type === 'PropertyAccess') {
    return callee.property.name
  }

  return undefined
}
