import { createSerialPattern, loopPattern } from '@core'
import { numeric } from '@utility'
import { NumberFacet } from '../../type-system/base/number.js'
import { PatternFacet } from '../../type-system/domain/pattern.js'
import { Functions, Modules } from '../../type-system/helpers.js'
import type { Value } from '../../type-system/types.js'

const loop = Functions.of({
  summary: 'Repeats a pattern for a fixed number of cycles, or indefinitely when times is omitted.',
  parameters: [
    { name: 'pattern', type: PatternFacet.type(), required: true },
    { name: 'times', type: NumberFacet.with(undefined).type(), required: false }
  ],

  returnType: PatternFacet.type(),

  invoke: (context, { pattern, times }) => {
    const patternValue = PatternFacet.get(pattern)

    if (times == null) {
      return PatternFacet.type().of(loopPattern(patternValue))
    }

    const { value: factor } = NumberFacet.get(times)
    if (factor <= 0 || !Number.isFinite(factor)) {
      return PatternFacet.type().of(createSerialPattern([], 1))
    }

    if (patternValue.length == null) {
      // infinite pattern multiplied by finite factor remains infinite
      return PatternFacet.type().of(loopPattern(patternValue))
    }

    const duration = numeric('beats', patternValue.length.value * factor)

    return PatternFacet.type().of(loopPattern(patternValue, duration))
  }
})

const fill = Functions.of({
  summary: 'Repeats a pattern until it fills the specified duration. Longer patterns are truncated.',
  parameters: [
    { name: 'pattern', type: PatternFacet.type(), required: true },
    { name: 'duration', type: NumberFacet.with('beats').type(), required: true }
  ],

  returnType: PatternFacet.type(),

  invoke: (context, { pattern, duration }) => {
    const patternValue = PatternFacet.get(pattern)
    const durationValue = NumberFacet.get(duration)

    if (durationValue.value <= 0 || !Number.isFinite(durationValue.value)) {
      return PatternFacet.type().of(createSerialPattern([], 1))
    }

    return PatternFacet.type().of(loopPattern(patternValue, durationValue))
  }
})

export const patternsModule = Modules.of({
  name: 'patterns',
  summary: 'Functions for creating and manipulating patterns.',

  exports: new Map<string, Value>([
    ['loop', loop],
    ['fill', fill]
  ])
})
