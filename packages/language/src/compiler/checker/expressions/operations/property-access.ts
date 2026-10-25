import { ast } from '@meyfa/cadence-ast'
import { ModuleFacet } from '../../../../type-system/base/module.ts'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { RecordFacet } from '../../../../type-system/base/record.ts'
import { PatternFacet } from '../../../../type-system/domain/pattern.ts'
import type { FacetType, Type } from '../../../../type-system/types.ts'
import { patternBuiltins } from '../../../builtins/patterns.ts'
import { CompileError } from '../../../error.ts'
import { isSyntaxUnit, toBaseUnit } from '../../../units.ts'
import { mergeCapabilities, noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'
import { liftOverFacetType } from '../utilities.ts'

export function checkPropertyAccess (scope: Scope, expression: ast.PropertyAccess): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const objectCheck = checkExpression(scope, expression.object)
  errors.push(...objectCheck.errors)
  capabilities = mergeCapabilities(capabilities, objectCheck.capabilities)

  if (objectCheck.result == null) {
    return { errors, capabilities }
  }

  const { property } = expression
  const object = objectCheck.result

  const lifted = liftOverFacetType(object, (facetType) => {
    return checkPropertyAccessWithObjectAtom(facetType, property)
  })
  errors.push(...lifted.errors)
  capabilities = mergeCapabilities(capabilities, lifted.capabilities)

  return { errors, capabilities, result: lifted.result }
}

function checkPropertyAccessWithObjectAtom (
  object: FacetType,
  property: ast.Identifier
): Checked<Type> {
  const errors: CompileError[] = []
  const capabilities = noCapabilities

  if (NumberFacet.is(object)) {
    if (!isSyntaxUnit(property.name)) {
      errors.push(new CompileError(`Unknown unit "${property.name}"`, property.range))
      return { errors, capabilities }
    }

    const existingUnit = NumberFacet.detail(object)
    if (existingUnit != null) {
      errors.push(new CompileError(`Cannot apply unit "${property.name}" to number with existing unit "${existingUnit}"`, property.range))
      return { errors, capabilities }
    }

    return { errors, capabilities, result: NumberFacet.with(toBaseUnit(property.name)).type() }
  }

  if (PatternFacet.is(object)) {
    const builtin = patternBuiltins.get(property.name)
    if (builtin != null) {
      return { errors, capabilities, result: builtin.type }
    }
  }

  if (RecordFacet.is(object)) {
    const record = RecordFacet.detail(object)
    if (Object.hasOwn(record, property.name)) {
      return { errors, capabilities, result: record[property.name] }
    }

    // Improve error messages for modules
    if (ModuleFacet.is(object)) {
      const moduleName = ModuleFacet.detail(object).name
      errors.push(new CompileError(`Module "${moduleName}" has no export named "${property.name}"`, property.range))

      return { errors, capabilities }
    }
  }

  errors.push(new CompileError(`Type ${object.format()} has no property named "${property.name}"`, property.range))

  return { errors, capabilities }
}
