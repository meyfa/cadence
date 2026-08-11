import type { SourceRange, ast } from '@meyfa/cadence-ast'
import { BooleanFacet } from '../../type-system/base/boolean.ts'
import type { Capabilities } from '../../type-system/base/function.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import type { FacetType } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import { checkExpression } from './expressions.ts'
import type { MutableScope } from './scopes.ts'
import { createLocalScope } from './scopes.ts'
import { nonNull } from '../assert.ts'

export interface CheckedStatement {
  readonly errors: readonly CompileError[]
  readonly capabilities: Capabilities
  readonly emissions: readonly Emission[]
  readonly properties: ReadonlyMap<string, FacetType>
}

export interface Emission {
  readonly type: FacetType
  readonly range: SourceRange
}

export function checkStatement (
  scope: MutableScope,
  statement: ast.Statement,
  existingProperties?: ReadonlyMap<string, FacetType>
): CheckedStatement {
  switch (statement.type) {
    case 'SimpleStatement':
      return checkSimpleStatement(scope, statement, existingProperties)

    case 'IfStatement':
      return checkIfStatement(scope, statement, existingProperties)
  }
}

function checkSimpleStatement (
  scope: MutableScope,
  statement: ast.SimpleStatement,
  existingProperties?: ReadonlyMap<string, FacetType>
): CheckedStatement {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const emissions: Emission[] = []
  const properties = new Map<string, FacetType>()

  const values: Array<FacetType | undefined> = []

  for (const value of statement.values) {
    const valueCheck = checkExpression(scope, value)
    errors.push(...valueCheck.errors)
    values.push(valueCheck.result)
    capabilities = mergeCapabilities(capabilities, valueCheck.capabilities)
  }

  if (statement.emit) {
    for (let i = 0; i < values.length; ++i) {
      const { range } = statement.values[i]

      const type = values[i]
      if (type == null) {
        continue
      }

      emissions.push({ type, range })
    }
  }

  if (statement.name != null) {
    const name = statement.name.name
    const type = values.at(0)

    const duplicate = scope.resolutions.has(name)
    if (duplicate) {
      errors.push(new CompileError(`Identifier "${name}" is already defined`, statement.name.range))
    }

    if (type != null && !duplicate) {
      scope.resolutions.set(name, { name, type, definite: true })
    }
  }

  if (statement.expose) {
    const propertyName = statement.name.name
    const propertyValue = values.at(0)

    if (existingProperties?.has(propertyName) === true) {
      errors.push(new CompileError(`Duplicate property "${propertyName}"`, statement.name.range))
    } else if (propertyValue != null) {
      properties.set(propertyName, values.at(0) ?? StringFacet.type())
    }
  }

  return { errors, capabilities, emissions, properties }
}

function checkIfStatement (
  scope: MutableScope,
  statement: ast.IfStatement,
  existingProperties?: ReadonlyMap<string, FacetType>
): CheckedStatement {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const emissions: Emission[] = []
  const properties = new Map<string, FacetType>()

  const conditionCheck = checkExpression(scope, statement.condition)
  errors.push(...conditionCheck.errors)
  capabilities = mergeCapabilities(capabilities, conditionCheck.capabilities)

  if (conditionCheck.result != null && !BooleanFacet.is(conditionCheck.result)) {
    errors.push(new CompileError(`Condition must be of type ${BooleanFacet.format()}, got ${conditionCheck.result.format()}`, statement.condition.range))
  }

  const thenScope = createLocalScope(scope)
  const elseScope = createLocalScope(scope)

  const thenBranch = checkBranch(thenScope, statement.thenBranch, existingProperties)
  errors.push(...thenBranch.errors)
  capabilities = mergeCapabilities(capabilities, thenBranch.capabilities)

  const elseBranch = checkBranch(elseScope, statement.elseBranch ?? [], existingProperties)
  errors.push(...elseBranch.errors)
  capabilities = mergeCapabilities(capabilities, elseBranch.capabilities)

  const assignedNames = new Set<string>([...thenScope.resolutions.keys(), ...elseScope.resolutions.keys()])

  for (const name of assignedNames) {
    const thenBinding = thenScope.resolutions.get(name)
    const elseBinding = elseScope.resolutions.get(name)

    if (scope.resolutions.has(name)) {
      const message = `Identifier "${name}" is already defined`
      if (thenBinding != null) {
        errors.push(new CompileError(message, thenBinding.range))
      }
      if (elseBinding != null) {
        errors.push(new CompileError(message, elseBinding.range))
      }
      continue
    }

    if (thenBinding == null || elseBinding == null) {
      const binding = nonNull(thenBinding ?? elseBinding)
      scope.resolutions.set(name, { ...binding, definite: false })
      continue
    }

    if (!thenBinding.type.is(elseBinding.type) || !elseBinding.type.is(thenBinding.type)) {
      const range = elseBinding.range ?? thenBinding.range ?? statement.range
      errors.push(new CompileError(`Incompatible types for "${name}" in conditional branches: ${thenBinding.type.format()} and ${elseBinding.type.format()}`, range))
      continue
    }

    scope.resolutions.set(name, {
      ...thenBinding,
      definite: thenBinding.definite && elseBinding.definite,
      range: undefined
    })
  }

  return { errors, capabilities, emissions, properties }
}

function checkBranch (
  scope: MutableScope,
  statements: readonly ast.Statement[],
  existingProperties?: ReadonlyMap<string, FacetType>
): CheckedStatement {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const emissions: Emission[] = []
  const properties = new Map<string, FacetType>()

  for (const child of statements) {
    const statement = checkStatement(scope, child, existingProperties)
    errors.push(...statement.errors)
    capabilities = mergeCapabilities(capabilities, statement.capabilities)

    if (statement.emissions.length > 0) {
      errors.push(new CompileError('Emissions in conditional branches are not yet supported', child.range))
    }

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Property exposure in conditional branches is not yet supported', child.range))
    }
  }

  return { errors, capabilities, emissions, properties }
}
