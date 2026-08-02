import type { Pattern } from '@meyfa/cadence-core'
import { createSerialPattern, loopPattern } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import type { FunctionSpec } from '../../type-system/base/function.ts'
import { FunctionFacet } from '../../type-system/base/function.ts'
import { NumberFacet } from '../../type-system/base/number.ts'
import { PatternFacet } from '../../type-system/domain/pattern.ts'
import { Functions } from '../../type-system/helpers.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { FacetType, Value } from '../../type-system/types.ts'

interface Builtin<T> {
  readonly type: FacetType
  readonly bind: (self: T) => Value
}

export type PatternBuiltin = Builtin<Pattern>

const loopSpec = {
  parameters: makeSchema([
    { name: 'times', type: NumberFacet.with(undefined).type(), required: false }
  ]),
  returnType: PatternFacet.type(),
  capabilities: { mayBlock: false }
} satisfies FunctionSpec

const loop: PatternBuiltin = {
  type: FunctionFacet.with(loopSpec).type(),

  bind: (pattern) => Functions.of(loopSpec, {
    summary: 'Repeats a pattern for a fixed number of cycles, or indefinitely when times is omitted.',

    invoke: (context, { times }) => {
      if (times == null) {
        return PatternFacet.type().of(loopPattern(pattern))
      }

      const { value: factor } = NumberFacet.get(times)
      if (factor <= 0 || !Number.isFinite(factor)) {
        return PatternFacet.type().of(createSerialPattern([]))
      }

      if (pattern.length == null) {
        // infinite pattern multiplied by finite factor remains infinite
        return PatternFacet.type().of(loopPattern(pattern))
      }

      const duration = pattern.length * factor as Numeric<'beats'>

      return PatternFacet.type().of(loopPattern(pattern, duration))
    }
  })
}

const fillSpec = {
  parameters: makeSchema([
    { name: 'duration', type: NumberFacet.with('beats').type(), required: true }
  ]),
  returnType: PatternFacet.type(),
  capabilities: { mayBlock: false }
} satisfies FunctionSpec

const fill: PatternBuiltin = {
  type: FunctionFacet.with(fillSpec).type(),

  bind: (pattern) => Functions.of(fillSpec, {
    summary: 'Repeats a pattern until it fills the specified duration. Longer patterns are truncated.',

    invoke: (context, { duration }) => {
      const durationValue = NumberFacet.get(duration)

      if (durationValue.value <= 0 || !Number.isFinite(durationValue.value)) {
        return PatternFacet.type().of(createSerialPattern([]))
      }

      return PatternFacet.type().of(loopPattern(pattern, durationValue.value))
    }
  })
}

export const patternBuiltins: ReadonlyMap<string, PatternBuiltin> = new Map([
  ['loop', loop],
  ['fill', fill]
])
