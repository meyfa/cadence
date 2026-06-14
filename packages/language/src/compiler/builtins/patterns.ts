import type { Pattern } from '@core'
import { createSerialPattern, loopPattern } from '@core'
import { numeric } from '@utility'
import { FunctionFacet } from '../../type-system/base/function.js'
import { NumberFacet } from '../../type-system/base/number.js'
import { PatternFacet } from '../../type-system/domain/pattern.js'
import { Functions } from '../../type-system/helpers.js'
import { makeSchema } from '../../type-system/schema.js'
import type { FacetType, Value } from '../../type-system/types.js'

interface Builtin<T> {
  readonly type: FacetType
  readonly bind: (self: T) => Value
}

export type PatternBuiltin = Builtin<Pattern>

const loopDeclaration = {
  parameters: makeSchema([
    { name: 'times', type: NumberFacet.with(undefined).type(), required: false }
  ]),

  returnType: PatternFacet.type()
} as const

const loop: PatternBuiltin = {
  type: FunctionFacet.with(loopDeclaration).type(),

  bind: (pattern) => Functions.of({
    ...loopDeclaration,

    summary: 'Repeats a pattern for a fixed number of cycles, or indefinitely when times is omitted.',

    invoke: (context, { times }) => {
      if (times == null) {
        return PatternFacet.type().of(loopPattern(pattern))
      }

      const { value: factor } = NumberFacet.get(times)
      if (factor <= 0 || !Number.isFinite(factor)) {
        return PatternFacet.type().of(createSerialPattern([], 1))
      }

      if (pattern.length == null) {
        // infinite pattern multiplied by finite factor remains infinite
        return PatternFacet.type().of(loopPattern(pattern))
      }

      const duration = numeric('beats', pattern.length.value * factor)

      return PatternFacet.type().of(loopPattern(pattern, duration))
    }
  })
}

const fillDeclaration = {
  parameters: makeSchema([
    { name: 'duration', type: NumberFacet.with('beats').type(), required: true }
  ]),

  returnType: PatternFacet.type()
} as const

const fill: PatternBuiltin = {
  type: FunctionFacet.with(fillDeclaration).type(),

  bind: (pattern) => Functions.of({
    ...fillDeclaration,

    summary: 'Repeats a pattern until it fills the specified duration. Longer patterns are truncated.',

    invoke: (context, { duration }) => {
      const durationValue = NumberFacet.get(duration)

      if (durationValue.value <= 0 || !Number.isFinite(durationValue.value)) {
        return PatternFacet.type().of(createSerialPattern([], 1))
      }

      return PatternFacet.type().of(loopPattern(pattern, durationValue))
    }
  })
}

export const patternBuiltins: ReadonlyMap<string, PatternBuiltin> = new Map([
  ['loop', loop],
  ['fill', fill]
])
