import { makeNumeric, type Pattern, type Step } from './program.js'

const zeroSteps = makeNumeric('steps', 0)

const emptyPattern: Pattern = {
  finite: true,
  length: makeNumeric('steps', 0),
  evaluate: function* (): Iterable<Step> {}
}

export function createPattern (steps: readonly Step[]): Pattern {
  return {
    finite: true,
    length: makeNumeric('steps', steps.length),
    evaluate: () => steps
  }
}

/**
 * Concatenate two patterns into a single pattern.
 */
export function concatPatterns (first: Pattern, second: Pattern): Pattern {
  if (!first.finite || (second.finite && second.length.value === 0)) {
    return first
  }

  if (first.length.value === 0) {
    return second
  }

  const finite = second.finite
  const length = makeNumeric('steps', !finite ? 0 : first.length.value + second.length.value)

  return {
    finite,
    length,
    evaluate: function* (): Iterable<Step> {
      yield* first.evaluate()
      yield* second.evaluate()
    }
  }
}

/**
 * Loop a pattern to reach a specific number of steps, or infinitely if no step count is provided.
 */
export function loopPattern (pattern: Pattern, steps?: number): Pattern {
  if (steps == null) {
    if (!pattern.finite) {
      return pattern
    }

    return {
      finite: false,
      length: zeroSteps,
      evaluate: function* (): Iterable<Step> {
        for (;;) {
          for (const step of pattern.evaluate()) {
            yield step
          }
        }
      }
    }
  }

  const len = Math.floor(steps)
  if (len <= 0 || !Number.isFinite(len)) {
    return emptyPattern
  }

  return {
    finite: true,
    length: makeNumeric('steps', len),
    evaluate: function* (): Iterable<Step> {
      let count = 0
      for (;;) {
        for (const step of pattern.evaluate()) {
          if (count >= len) {
            return
          }
          yield step
          ++count
        }
      }
    }
  }
}

/**
 * Multiply a pattern by a numeric factor.
 *
 * If the pattern is infinite, the resulting pattern will remain infinite.
 * Otherwise, the resulting pattern will be finite, with its length multiplied by the factor.
 */
export function multiplyPattern (pattern: Pattern, times: number): Pattern {
  // Infinite patterns remain infinite when multiplied
  if (!pattern.finite) {
    return pattern
  }

  // This also handles the zero and negative cases
  return loopPattern(pattern, pattern.length.value * times)
}

/**
 * Render a pattern to a fixed number of steps. Longer patterns will be truncated,
 * while shorter patterns will be padded with rests.
 */
export function renderPatternSteps (pattern: Pattern, length: number): Step[] {
  const count = Math.floor(length)
  if (count <= 0 || !Number.isFinite(count)) {
    return []
  }

  const steps = new Array<Step>(length).fill('-')

  let index = 0
  for (const step of pattern.evaluate()) {
    if (index >= count) {
      break
    }
    steps[index++] = step
  }

  return steps
}
