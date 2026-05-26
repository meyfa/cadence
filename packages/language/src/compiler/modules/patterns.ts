import { createSerialPattern, loopPattern } from '@core'
import { numeric } from '@utility'
import { FunctionType, ModuleType, NumberType, PatternType, Value } from '../types.js'

const loop = FunctionType.of({
  summary: 'Repeats a pattern for a fixed number of cycles, or indefinitely when times is omitted.',
  arguments: [
    { name: 'pattern', type: PatternType, required: true },
    { name: 'times', type: NumberType.with(undefined), required: false }
  ],

  returnType: PatternType,

  invoke: (_context, { pattern, times }) => {
    if (times == null) {
      return PatternType.of(loopPattern(pattern))
    }

    const factor = times.value
    if (factor <= 0 || !Number.isFinite(factor)) {
      return PatternType.of(createSerialPattern([], 1))
    }

    if (pattern.length == null) {
      // infinite pattern multiplied by finite factor remains infinite
      return PatternType.of(loopPattern(pattern))
    }

    const duration = numeric('beats', pattern.length.value * factor)

    return PatternType.of(loopPattern(pattern, duration))
  }
})

const fill = FunctionType.of({
  summary: 'Repeats a pattern until it fills the specified duration. Longer patterns are truncated.',
  arguments: [
    { name: 'pattern', type: PatternType, required: true },
    { name: 'duration', type: NumberType.with('beats'), required: true }
  ],

  returnType: PatternType,

  invoke: (_context, { pattern, duration }) => {
    if (duration.value <= 0 || !Number.isFinite(duration.value)) {
      return PatternType.of(createSerialPattern([], 1))
    }

    return PatternType.of(loopPattern(pattern, duration))
  }
})

export const patternsModule = ModuleType.of({
  name: 'patterns',
  summary: 'Functions for creating and manipulating patterns.',

  exports: new Map<string, Value>([
    ['loop', loop],
    ['fill', fill]
  ])
})
