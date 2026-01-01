import { isPitch, makeNumeric, type NoteEvent, type Numeric, type Pattern, type Step } from './program.js'

const zeroSteps = makeNumeric('steps', 0)

const emptyPattern: Pattern = {
  length: zeroSteps,
  evaluate: () => []
}

/**
 * Create a pattern with length equal to the number of steps, equally spaced.
 */
export function createPattern (steps: readonly Step[]): Pattern {
  const events: NoteEvent[] = []

  for (let i = 0; i < steps.length; ++i) {
    const step = steps[i]
    if (step === '-') {
      continue
    }

    if (isPitch(step)) {
      events.push({ time: makeNumeric('steps', i), pitch: step })
      continue
    }

    events.push({ time: makeNumeric('steps', i) })
  }

  return {
    length: makeNumeric('steps', steps.length),
    evaluate: () => events
  }
}

/**
 * Concatenate two patterns into a single pattern.
 */
export function concatPatterns (first: Pattern, second: Pattern): Pattern {
  // first is infinite or second is empty
  if (first.length == null || second.length?.value === 0) {
    return first
  }

  // first is empty
  if (first.length.value === 0) {
    return second
  }

  const length = second.length != null
    ? makeNumeric('steps', first.length.value + second.length.value)
    : undefined

  const secondOffset = first.length.value

  return {
    length,
    evaluate: function* () {
      yield* first.evaluate()

      for (const event of second.evaluate()) {
        yield {
          ...event,
          time: makeNumeric('steps', event.time.value + secondOffset)
        }
      }
    }
  }
}

/**
 * Loop a pattern to achieve a specific length, or infinitely if no duration is provided.
 *
 * Notable behaviors:
 * - Empty patterns will stay empty when looped, regardless of the specified duration.
 * - Patterns that are longer than the specified duration will be truncated.
 * - Patterns that are shorter than the specified duration will be repeated (and possibly truncated) to fit.
 */
export function loopPattern (pattern: Pattern, duration?: Numeric<'steps'>): Pattern {
  const patternLength = pattern.length?.value

  // Looping an empty pattern always results in an empty pattern
  if (patternLength != null && patternLength <= 0) {
    return pattern
  }

  if (duration == null) {
    // Pattern is already infinite
    if (patternLength == null) {
      return pattern
    }

    // Input pattern is finite, and not empty, so it can be looped
    return {
      length: undefined,
      evaluate: function* () {
        let hasEvents = false
        let offset = 0

        do {
          for (const event of pattern.evaluate()) {
            hasEvents = true
            yield {
              ...event,
              time: makeNumeric('steps', event.time.value + offset)
            }
          }

          offset += patternLength
        } while (hasEvents)
      }
    }
  }

  if (duration.value <= 0 || !Number.isFinite(duration.value)) {
    return emptyPattern
  }

  // Input pattern is guaranteed not to be empty, but may or may not be finite
  return {
    length: duration,
    evaluate: function* () {
      let hasEvents = false
      let offset = 0

      do {
        for (const event of pattern.evaluate()) {
          if (offset + event.time.value >= duration.value) {
            return
          }

          hasEvents = true
          yield {
            ...event,
            time: makeNumeric('steps', event.time.value + offset)
          }
        }

        // will only get here if pattern is finite
        offset += patternLength ?? 0
      } while (hasEvents)
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
  if (pattern.length == null) {
    return pattern
  }

  // This also handles the zero and negative cases
  return loopPattern(pattern, makeNumeric('steps', pattern.length.value * times))
}

/**
 * Render a pattern to up to a specific time. Longer patterns will be truncated,
 * while shorter patterns will stay as-is (no additional events are produced).
 */
export function renderPatternEvents (pattern: Pattern, end: Numeric<'steps'>): NoteEvent[] {
  if (end.value <= 0 || !Number.isFinite(end.value)) {
    return []
  }

  const events: NoteEvent[] = []

  for (const event of pattern.evaluate()) {
    if (event.time.value >= end.value) {
      break
    }
    events.push(event)
  }

  return events
}
