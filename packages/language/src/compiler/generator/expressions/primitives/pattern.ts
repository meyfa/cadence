import { ast } from '@meyfa/cadence-ast'
import type { Pattern, Step } from '@meyfa/cadence-core'
import { concatPatterns, createParallelPattern, createSerialPattern, mergePatterns } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { PatternFacet } from '../../../../type-system/domain/pattern.ts'
import type { Value } from '../../../../type-system/types.ts'
import { stepSchema } from '../../../common.ts'
import type { Scope } from '../../scopes.ts'
import { resolveArgumentList } from '../arguments.ts'
import { resolve } from '../index.ts'
import { clamped } from '../utilities.ts'

export function generatePattern (scope: Scope, expression: ast.Pattern): Value {
  const create = expression.mode === 'serial'
    ? (steps: readonly Step[]) => createSerialPattern(steps)
    : (steps: readonly Step[]) => createParallelPattern(steps)

  const combine = expression.mode === 'serial'
    ? (patterns: readonly Pattern[]) => concatPatterns(patterns)
    : (patterns: readonly Pattern[]) => mergePatterns(patterns)

  const resolved = expression.children.map((child) => {
    return child.type === 'Step'
      ? generateStep(scope, child)
      : PatternFacet.get(resolve(scope, child))
  })

  const isStep = (item: Step | Pattern): item is Step => 'value' in item
  const stepCount = resolved.filter(isStep).length

  // all steps or empty pattern
  if (stepCount === resolved.length) {
    return PatternFacet.type().of(create(resolved as readonly Step[]))
  }

  // all sub-patterns
  if (stepCount === 0) {
    return PatternFacet.type().of(combine(resolved as readonly Pattern[]))
  }

  // general case (mixed steps and sub-patterns)
  const patterns = resolved.map((child) => {
    return isStep(child) ? create([child]) : child
  })

  return PatternFacet.type().of(combine(patterns))
}

function generateStep (scope: Scope, expression: ast.Step): Step {
  const { value } = expression

  const length = expression.length != null
    ? NumberFacet.with(undefined).get(resolve(scope, expression.length)).value as unknown as Numeric<'beats'>
    : undefined

  const args = resolveArgumentList(scope, expression.arguments, stepSchema)
  const gate = args.gate != null
    ? NumberFacet.get(args.gate).value as unknown as Numeric<'beats'>
    : undefined
  const velocity = args.vel != null
    ? clamped(NumberFacet.get(args.vel), 0, 1).value as unknown as Numeric<undefined>
    : undefined

  if (length == null) {
    return { value, gate, velocity }
  }

  return { value, length, gate, velocity }
}
