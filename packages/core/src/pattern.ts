import { makeNumeric, type NoteEvent, type Numeric, type Pattern, type Step } from './program.js'

const zeroBeats = makeNumeric('beats', 0)

const emptyPattern: Pattern = {
  length: zeroBeats,
  evaluate: () => []
}

/**
 * Create a pattern with equally spaced steps based on the provided subdivision.
 * For example, assuming a 4/4 time signature, a subdivision of 1 would create quarter notes,
 * while a subdivision of 4 would create sixteenth notes.
 */
export function createPattern (steps: readonly Step[], subdivision: number): Pattern {
  if (steps.length === 0 || subdivision <= 0 || !Number.isFinite(subdivision)) {
    return emptyPattern
  }

  const events: NoteEvent[] = []

  const defaultStepLength = 1 / subdivision

  let offset = 0

  for (const step of steps) {
    const stepLength = defaultStepLength * (step.length?.value ?? 1)
    if (stepLength <= 0 || !Number.isFinite(stepLength)) {
      continue
    }

    const stepGate = defaultStepLength * (step.gate?.value ?? step.length?.value ?? 1)
    const gate = makeNumeric('beats', stepGate)

    if (step.value !== '-') {
      const time = makeNumeric('beats', offset)
      events.push(step.value === 'x' ? { time, gate } : { time, gate, pitch: step.value })
    }

    offset += stepLength
  }

  const length = makeNumeric('beats', offset)

  return { length, evaluate: () => events }
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
    ? makeNumeric('beats', first.length.value + second.length.value)
    : undefined

  const secondOffset = first.length.value

  return {
    length,
    evaluate: function* () {
      yield* first.evaluate()

      for (const event of second.evaluate()) {
        yield {
          ...event,
          time: makeNumeric('beats', event.time.value + secondOffset)
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
export function loopPattern (pattern: Pattern, duration?: Numeric<'beats'>): Pattern {
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
              time: makeNumeric('beats', event.time.value + offset)
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
            time: makeNumeric('beats', event.time.value + offset)
          }
        }

        // will only get here if pattern is finite
        offset += patternLength ?? 0
      } while (hasEvents)
    }
  }
}

/**
 * Multiply a pattern by a numeric factor, keeping the sequence of events the same but adjusting their timing.
 *
 * For example, multiplying a pattern of length 2 by 3 will produce a pattern of length 6 where each event occurs
 * at three times the original time.
 *
 * The factor must be strictly positive (> 0), otherwise an empty pattern is returned.
 */
export function multiplyPattern (pattern: Pattern, times: number): Pattern {
  // empty pattern remains empty
  if (pattern.length != null && pattern.length.value <= 0) {
    return pattern
  }

  // multiplying by 1 returns the same pattern
  if (times === 1) {
    return pattern
  }

  // invalid factor results in empty pattern
  if (times <= 0 || !Number.isFinite(times)) {
    return createPattern([], 1)
  }

  // infinite pattern remains infinite, otherwise scale length
  const length = pattern.length != null
    ? makeNumeric('beats', pattern.length.value * times)
    : undefined

  return {
    length,
    evaluate: function* () {
      for (const event of pattern.evaluate()) {
        yield {
          ...event,
          time: makeNumeric('beats', event.time.value * times),
          gate: event.gate != null
            ? makeNumeric('beats', event.gate.value * times)
            : undefined
        }
      }
    }
  }
}

/**
 * Render a pattern to up to a specific time. Longer patterns will be truncated,
 * while shorter patterns will stay as-is (no additional events are produced).
 */
export function renderPatternEvents (pattern: Pattern, end: Numeric<'beats'>): NoteEvent[] {
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
