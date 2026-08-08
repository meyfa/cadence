import type { SourceRange, ast } from '@meyfa/cadence-ast'
import type { Capabilities } from '../../type-system/base/function.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import type { FacetType } from '../../type-system/types.ts'
import { CompileError } from '../error.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import { checkExpression } from './expressions.ts'
import type { MutableScope } from './scopes.ts'

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
    const duplicate = scope.resolutions.has(statement.name.name)
    if (duplicate) {
      errors.push(new CompileError(`Identifier "${statement.name.name}" is already defined`, statement.name.range))
    }

    const type = values.at(0)
    if (type != null && !duplicate) {
      scope.resolutions.set(statement.name.name, type)
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
