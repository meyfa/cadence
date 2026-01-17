import { createSerialPattern, loopPattern } from '@core/pattern.js'
import { makeNumeric } from '@core/program.js'
import { FunctionType, ModuleType, NumberType, PatternType, Value } from '../types.js'

const loop = FunctionType.of({
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

    const duration = makeNumeric('beats', pattern.length.value * factor)

    return PatternType.of(loopPattern(pattern, duration))
  }
})

export const patternsModule = ModuleType.of({
  name: 'patterns',

  exports: new Map<string, Value>([
    ['loop', loop]
  ])
})
