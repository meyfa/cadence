import { ast } from '@meyfa/cadence-ast'
import { setAll } from '@meyfa/cadence-utility'
import type { FunctionSpec } from '../../../../type-system/base/function.ts'
import { FunctionFacet } from '../../../../type-system/base/function.ts'
import type { Type } from '../../../../type-system/types.ts'
import { nonNull } from '../../../assert.ts'
import { CompileError } from '../../../error.ts'
import { mergeCapabilities, noCapabilities } from '../../capabilities.ts'
import type { MutableEmissions, SlotName } from '../../emissions.ts'
import { addEmission, validateEmissions } from '../../emissions.ts'
import { checkParameters } from '../../parameters.ts'
import type { Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import type { StatementOptions } from '../../statements.ts'
import { checkStatement } from '../../statements.ts'
import type { Checked } from '../types.ts'

const returnSlotName = 'return' as SlotName

const functionStatementOptions: StatementOptions = {
  context: 'function',
  slots: [
    {
      name: returnSlotName,
      type: 'infer',
      required: true,
      singular: true
    }
  ]
}

export function checkFunction (scope: Scope, expression: ast.Function): Checked<Type> {
  const errors: CompileError[] = []

  // Allow blocking calls inside the function. If a blocking call is encountered,
  // then the function itself will be marked as blocking when called.
  const functionScope = createLocalScope(scope, { mayBlock: true })

  // The act of constructing a function does not in itself require any capabilities.
  const capabilities = noCapabilities

  const parameterCheck = checkParameters(expression.parameters)
  errors.push(...parameterCheck.errors)
  if (parameterCheck.errors.length > 0) {
    // If the parameters are invalid, it makes no sense to continue checking the function body,
    // as it will produce a lot of irrelevant errors as a consequence.
    return { errors, capabilities }
  }

  const parameters = parameterCheck.schema
  setAll(functionScope.resolutions, parameterCheck.bindings)

  const emissions: MutableEmissions = new Map()
  let callCapabilities = noCapabilities

  for (const child of expression.children) {
    const statement = checkStatement(functionScope, child, functionStatementOptions)
    errors.push(...statement.errors)
    callCapabilities = mergeCapabilities(callCapabilities, statement.capabilities)

    for (const emission of statement.emissions.values()) {
      errors.push(...addEmission(emissions, emission))
    }

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Cannot expose properties in a function', child.range))
    }
  }

  errors.push(...validateEmissions(emissions, functionStatementOptions.slots ?? [], expression.range))

  if (errors.length > 0) {
    // If there are errors here, the return type most likely cannot be determined correctly.
    return { errors, capabilities }
  }

  const returnType = nonNull(emissions.get(returnSlotName)?.type)

  const spec: FunctionSpec = { parameters, returnType, capabilities: callCapabilities }
  const result = FunctionFacet.with(spec).type()
  scope.top.semantic.functions.set(expression, spec)

  return { errors, capabilities, result }
}
