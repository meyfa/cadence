import { ast } from '@meyfa/cadence-ast'
import type { RelativeCurveSegment } from '@meyfa/cadence-core'
import type { RuntimeNumeric, Unit } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { CurveFacet } from '../../../../type-system/domain/curve.ts'
import { Curves } from '../../../../type-system/helpers.ts'
import type { Value } from '../../../../type-system/types.ts'
import { assert, nonNull } from '../../../assert.ts'
import { createCurve, createCurveSegment, getCurveSegmentType } from '../../../curves.ts'
import type { Scope } from '../../scopes.ts'
import { resolve } from '../index.ts'

export function generateCurve (scope: Scope, expression: ast.Curve): Value {
  const generatedSegments: Array<RelativeCurveSegment<Unit>> = []

  const getPreviousSegmentEnd = (): RuntimeNumeric<Unit> => {
    const previous = nonNull(generatedSegments.at(-1))
    const definition = nonNull(getCurveSegmentType(previous.type))
    return definition.end(previous)
  }

  for (const child of expression.children) {
    if (child.type !== 'CurveSegment') {
      const curve = CurveFacet.get(resolve(scope, child))
      generatedSegments.push(...curve.segments)
      continue
    }

    const segment = child
    const args = segment.arguments.map((point) => {
      return NumberFacet.get(resolve(scope, point))
    })

    const length = (() => {
      const value = NumberFacet.get(resolve(scope, segment.length))
      assert(value.unit === 'beats' || value.unit === 's')
      return value as RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>
    })()

    const { parameterCount } = nonNull(getCurveSegmentType(segment.curveType))
    const resolvedParameters = args.length < parameterCount
      ? [getPreviousSegmentEnd(), ...args]
      : args

    generatedSegments.push(createCurveSegment(segment.curveType, resolvedParameters, length))
  }

  assert(generatedSegments.length > 0)

  return Curves.of(createCurve(generatedSegments))
}
