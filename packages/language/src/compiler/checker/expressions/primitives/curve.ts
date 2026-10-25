import type { SourceRange } from '@meyfa/cadence-ast'
import { ast } from '@meyfa/cadence-ast'
import type { Unit } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { CurveFacet } from '../../../../type-system/domain/curve.ts'
import { makeUnionType } from '../../../../type-system/factory.ts'
import { getPossibleTypeAtoms } from '../../../../type-system/transforms.ts'
import type { Type } from '../../../../type-system/types.ts'
import { getCurveSegmentType } from '../../../curves.ts'
import { CompileError } from '../../../error.ts'
import { mergeCapabilities, noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'
import { expectType } from '../utilities.ts'

interface CurveDetail {
  readonly unit: Unit
}

export function checkCurve (scope: Scope, expression: ast.Curve): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  if (expression.children.length === 0) {
    errors.push(new CompileError('Curve must have at least one segment', expression.range))
    return { errors, capabilities }
  }

  let detail: CurveDetail | undefined

  const append = (unit: Unit, range: SourceRange): void => {
    if (detail == null) {
      detail = { unit }
      return
    }

    if (detail.unit !== unit) {
      errors.push(new CompileError('Curve segments must have the same unit', range))
    }
  }

  for (const item of expression.children) {
    switch (item.type) {
      case 'CurveSegment': {
        const itemCheck = checkCurveSegment(scope, item, detail)
        errors.push(...itemCheck.errors)
        capabilities = mergeCapabilities(capabilities, itemCheck.capabilities)

        if (itemCheck.result == null) {
          break
        }

        append(itemCheck.result.unit, item.range)
        break
      }

      default: {
        const itemCheck = checkExpression(scope, item)
        errors.push(...itemCheck.errors)
        capabilities = mergeCapabilities(capabilities, itemCheck.capabilities)

        if (itemCheck.result == null) {
          break
        }

        if (!CurveFacet.is(itemCheck.result)) {
          errors.push(...expectType(CurveFacet.type(), itemCheck.result, item.range))
          break
        }

        for (const itemType of getPossibleTypeAtoms(itemCheck.result)) {
          append(CurveFacet.detail(itemType), item.range)
        }
        break
      }
    }
  }

  if (errors.length > 0) {
    return { errors, capabilities }
  }

  const result = CurveFacet.with(detail?.unit).type()

  return { errors, capabilities, result }
}

const curveSegmentLengthType = makeUnionType(
  NumberFacet.with('beats').type(),
  NumberFacet.with('s').type()
)

function checkCurveSegment (scope: Scope, expression: ast.CurveSegment, detail?: CurveDetail): Checked<CurveDetail> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const { omittedFirstParameter, errors: arityErrors } = resolveCurveSegmentArity(expression, detail != null)
  errors.push(...arityErrors)
  if (omittedFirstParameter == null) {
    return { errors, capabilities }
  }

  const lengthCheck = checkCurveSegmentLength(scope, expression)
  errors.push(...lengthCheck.errors)
  capabilities = mergeCapabilities(capabilities, lengthCheck.capabilities)

  const pointsCheck = checkCurveSegmentPoints(scope, expression.arguments)
  errors.push(...pointsCheck.errors)
  capabilities = mergeCapabilities(capabilities, pointsCheck.capabilities)

  const units = pointsCheck.result ?? []
  if (!omittedFirstParameter && units.length === 0) {
    return { errors, capabilities }
  }

  const firstUnit = omittedFirstParameter ? detail?.unit : units[0]?.unit
  const remainingUnits = omittedFirstParameter ? units : units.slice(1)
  errors.push(...expectPointUnits(firstUnit, remainingUnits))

  return { errors, capabilities, result: { unit: firstUnit } }
}

function checkCurveSegmentLength (scope: Scope, expression: ast.CurveSegment): Checked<void> {
  const lengthCheck = checkExpression(scope, expression.length)
  const errors = [...lengthCheck.errors]

  if (lengthCheck.result != null) {
    errors.push(...expectType(curveSegmentLengthType, lengthCheck.result, expression.length.range))
  }

  return { errors, capabilities: lengthCheck.capabilities }
}

interface CheckedCurveSegmentArity {
  readonly errors: CompileError[]
  readonly omittedFirstParameter?: boolean
}

function resolveCurveSegmentArity (expression: ast.CurveSegment, hasPreviousSegment: boolean): CheckedCurveSegmentArity {
  const expectedParameters = getCurveSegmentType(expression.curveType)?.parameterCount
  if (expectedParameters == null) {
    return { errors: [new CompileError(`Unknown curve type "${expression.curveType}"`, expression.range)] }
  }

  const actualParameters = expression.arguments.length
  const omittedFirstParameter = expectedParameters > 0 && actualParameters === expectedParameters - 1

  if (omittedFirstParameter && !hasPreviousSegment) {
    return { errors: [new CompileError('First curve segment cannot omit its first argument', expression.range)] }
  }

  if (!omittedFirstParameter && actualParameters !== expectedParameters) {
    const object = expectedParameters === 1 ? 'argument' : 'arguments'
    const message = `Expected ${expectedParameters} ${object} for ${expression.curveType} curve, got ${actualParameters}`
    return { errors: [new CompileError(message, expression.range)] }
  }

  return { errors: [], omittedFirstParameter }
}

interface PointUnit {
  readonly unit: Unit | undefined
  readonly range: SourceRange
}

function checkCurveSegmentPoints (scope: Scope, points: readonly ast.Expression[]): Checked<readonly PointUnit[]> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities
  const units: PointUnit[] = []

  for (const point of points) {
    const pointCheck = checkExpression(scope, point)
    errors.push(...pointCheck.errors)
    capabilities = mergeCapabilities(capabilities, pointCheck.capabilities)

    if (pointCheck.result == null) {
      continue
    }

    const typeErrors = expectType(NumberFacet.type(), pointCheck.result, point.range)
    errors.push(...typeErrors)

    if (typeErrors.length > 0) {
      continue
    }

    for (const pointType of getPossibleTypeAtoms(pointCheck.result)) {
      units.push({ unit: NumberFacet.detail(pointType), range: point.range })
    }
  }

  return { errors, capabilities, result: units }
}

function expectPointUnits (expectedUnit: Unit | undefined, points: readonly PointUnit[]): readonly CompileError[] {
  const expected = NumberFacet.with(expectedUnit).type()
  return points.flatMap(({ unit, range }) => {
    return expectType(expected, NumberFacet.with(unit).type(), range)
  })
}
