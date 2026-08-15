import type { ast, SourceRange } from '@meyfa/cadence-ast'
import { BooleanFacet } from '../../type-system/base/boolean.ts'
import type { Capabilities } from '../../type-system/base/function.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import type { FacetType } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import type { Emission, Emissions, MutableEmissions, Slot, SlotName, Slots } from './emissions.ts'
import { addEmission } from './emissions.ts'
import { checkExpression } from './expressions.ts'
import type { MutableScope, Scope } from './scopes.ts'
import { createLocalScope } from './scopes.ts'

export interface StatementOptions {
  /**
   * For error messages: The name of the context in which the statement is being checked.
   */
  readonly context: string

  /**
   * The emissions that are allowed and expected within the statement (if any). If not specified or empty, no emissions are allowed.
   * Required types must be emitted _at least_ once; singular types may be emitted _at most_ once.
   */
  readonly slots?: Slots

  /**
   * The properties that are already exposed in the current scope (if any).
   * The statement may not expose names already present in this map.
   */
  readonly existingProperties?: ReadonlyMap<string, FacetType>
}

export interface CheckedStatement {
  readonly errors: readonly CompileError[]
  readonly capabilities: Capabilities

  /**
   * A map from slot names to emission information.
   */
  readonly emissions: ReadonlyMap<SlotName, Emission>

  /**
   * A map from property names to their types.
   */
  readonly properties: ReadonlyMap<string, FacetType>
}

export function checkStatement (scope: MutableScope, statement: ast.Statement, options: StatementOptions): CheckedStatement {
  switch (statement.type) {
    case 'SimpleStatement':
      return checkSimpleStatement(scope, statement, options)

    case 'IfStatement':
      return checkIfStatement(scope, statement, options)
  }
}

function checkSimpleStatement (scope: MutableScope, statement: ast.SimpleStatement, options: StatementOptions): CheckedStatement {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const emissions: MutableEmissions = new Map()
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
      if (type != null) {
        errors.push(...checkEmission(emissions, type, range, options))
      }
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

    if (options.existingProperties?.has(propertyName) === true) {
      errors.push(new CompileError(`Duplicate property "${propertyName}"`, statement.name.range))
    } else if (propertyValue != null) {
      properties.set(propertyName, values.at(0) ?? StringFacet.type())
    }
  }

  return { errors, capabilities, emissions, properties }
}

function checkEmission (emissions: MutableEmissions, type: FacetType, range: SourceRange, options: StatementOptions): readonly CompileError[] {
  const { context, slots = [] } = options

  if (slots.length === 0) {
    return [new CompileError(`Cannot emit values in this context (${context})`, range)]
  }

  const slot = slots.find((slot) => slot.type == 'infer' || slot.type.is(type))
  if (slot == null) {
    const expectedTypes = slots
      .filter((slot): slot is Slot & { type: FacetType } => slot.type != 'infer')
      .map((slot) => slot.type.format())
      .join(', ')
    return [new CompileError(`Unexpected emitted value of type ${type.format()}; expected one of: ${expectedTypes}`, range)]
  }

  const emission: Emission = {
    slot,
    type: slot.type === 'infer' ? type : undefined,
    minimum: 1,
    maximum: 1,
    ranges: [range]
  }

  return addEmission(emissions, emission)
}

function checkIfStatement (scope: MutableScope, statement: ast.IfStatement, options: StatementOptions): CheckedStatement {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const emissions: MutableEmissions = new Map()
  const properties = new Map<string, FacetType>()

  const conditionCheck = checkExpression(scope, statement.condition)
  errors.push(...conditionCheck.errors)
  capabilities = mergeCapabilities(capabilities, conditionCheck.capabilities)

  if (conditionCheck.result != null && !BooleanFacet.is(conditionCheck.result)) {
    errors.push(new CompileError(`Condition must be of type ${BooleanFacet.format()}, got ${conditionCheck.result.format()}`, statement.condition.range))
  }

  const thenScope = createLocalScope(scope)
  const elseScope = createLocalScope(scope)

  const thenBranch = checkBranch(thenScope, statement.thenBranch, options)
  errors.push(...thenBranch.errors)
  capabilities = mergeCapabilities(capabilities, thenBranch.capabilities)

  const elseBranch = checkBranch(elseScope, statement.elseBranch ?? [], options)
  errors.push(...elseBranch.errors)
  capabilities = mergeCapabilities(capabilities, elseBranch.capabilities)

  errors.push(...applyBranchAssignments(scope, [
    thenScope,
    elseScope
  ], statement.range))

  errors.push(...applyBranchEmissions(emissions, [
    thenBranch.emissions,
    elseBranch.emissions
  ], statement.range))

  return { errors, capabilities, emissions, properties }
}

function checkBranch (scope: MutableScope, statements: readonly ast.Statement[], options: StatementOptions): CheckedStatement {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const emissions: MutableEmissions = new Map()
  const properties = new Map<string, FacetType>()

  for (const child of statements) {
    const statement = checkStatement(scope, child, options)
    errors.push(...statement.errors)
    capabilities = mergeCapabilities(capabilities, statement.capabilities)

    for (const emission of statement.emissions.values()) {
      errors.push(...addEmission(emissions, emission))
    }

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Property exposure in conditional branches is not yet supported', child.range))
    }
  }

  return { errors, capabilities, emissions, properties }
}

function applyBranchAssignments (
  scope: MutableScope,
  branches: readonly Scope[],
  statementRange: SourceRange
): readonly CompileError[] {
  const errors: CompileError[] = []

  const assignedNames = new Set(branches.flatMap((branch) => [...branch.resolutions.keys()]))

  for (const name of assignedNames) {
    const bindings = branches.map((branch) => branch.resolutions.get(name))

    if (scope.resolutions.has(name)) {
      const message = `Identifier "${name}" is already defined`
      for (const binding of bindings) {
        if (binding != null) {
          errors.push(new CompileError(message, binding.range ?? statementRange))
        }
      }
      continue
    }

    const definite = bindings.every((binding) => binding?.definite === true)

    const types = bindings.map((binding) => binding?.type).filter((type) => type != null)
    const type = intersectTypes(types)

    const ranges = bindings.map((binding) => binding?.range).filter((range) => range != null)
    const range = ranges.length === 1 ? ranges[0] : undefined

    if (type == null) {
      const typeStrings = bindings.map((binding) => binding?.type.format() ?? '?').join(', ')
      const message = typeStrings !== ''
        ? `Incompatible types for "${name}" in conditional branches: ${typeStrings}`
        : `Incompatible types for "${name}" in conditional branches`
      errors.push(new CompileError(message, range ?? statementRange))
      continue
    }

    scope.resolutions.set(name, { name, type, definite, range })
  }

  return errors
}

function applyBranchEmissions (
  target: MutableEmissions,
  branches: readonly Emissions[],
  statementRange: SourceRange
): readonly CompileError[] {
  const errors: CompileError[] = []

  const emittedSlotNames = new Set(branches.flatMap((branch) => [...branch.keys()]))

  for (const slotName of emittedSlotNames) {
    const emissions = branches.map((branch) => branch.get(slotName)).filter((item) => item != null)

    const slot = emissions.at(0)?.slot
    if (slot == null) {
      continue
    }

    const complete = emissions.length === branches.length

    const minimum = complete ? Math.min(...emissions.map((item) => item.minimum)) : 0
    const maximum = Math.max(...emissions.map((item) => item.maximum))

    const ranges = emissions.flatMap((item) => item.ranges)

    let type: FacetType | undefined

    if (slot.type === 'infer') {
      const types = emissions.map((item) => item.type).filter((item) => item != null)
      type = intersectTypes(types)

      if (type == null) {
        const typeStrings = types.map((type) => type.format()).join(', ')
        const message = typeStrings !== ''
          ? `Incompatible types for slot "${slotName}" in conditional branches: ${typeStrings}`
          : `Incompatible types for slot "${slotName}" in conditional branches`
        errors.push(new CompileError(message, ranges.at(0) ?? statementRange))
        continue
      }
    }

    target.set(slotName, { slot, type, minimum, maximum, ranges })
  }

  return errors
}

function intersectTypes (types: readonly FacetType[]): FacetType | undefined {
  return types.reduce((acc, type) => acc?.intersect(type), types.at(0))
}
