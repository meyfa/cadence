import { makeNumeric, type NoteEvent, type Numeric, type Pattern, type Step } from './program.js'

const zeroBeats = makeNumeric('beats', 0)

const emptyPattern: Pattern = {
  length: zeroBeats,
  evaluate: () => []
}

function isPositiveFiniteNumber (value: number): boolean {
  return value > 0 && Number.isFinite(value)
}

function getSumOfLengths (patterns: readonly Pattern[]): Pattern['length'] {
  let sum = 0

  for (const pattern of patterns) {
    // Infinite pattern makes the sum infinite
    if (pattern.length == null) {
      return undefined
    }
    sum += pattern.length.value
  }

  return makeNumeric('beats', sum)
}

function getMaxLength (patterns: readonly Pattern[]): Pattern['length'] {
  let max = 0

  for (const pattern of patterns) {
    if (pattern.length == null) {
      return undefined
    }
    max = Math.max(max, pattern.length.value)
  }

  return makeNumeric('beats', max)
}

function pushStepEvent (events: NoteEvent[], step: Step, offset: number, baseLength = 1.0): void {
  if (step.value === '-') {
    return
  }

  const time = makeNumeric('beats', offset)

  const stepGate = baseLength * (step.gate?.value ?? step.length?.value ?? 1)
  const gate = makeNumeric('beats', stepGate)

  events.push(step.value === 'x' ? { time, gate } : { time, gate, pitch: step.value })
}

/**
 * Create a pattern with equally spaced steps based on the provided subdivision.
 * For example, assuming a 4/4 time signature, a subdivision of 1 would create quarter notes,
 * while a subdivision of 4 would create sixteenth notes.
 */
export function createSerialPattern (steps: readonly Step[], subdivision: number): Pattern {
  if (steps.length === 0 || !isPositiveFiniteNumber(subdivision)) {
    return emptyPattern
  }

  const defaultStepLength = 1 / subdivision

  const events: NoteEvent[] = []
  let offset = 0

  for (const step of steps) {
    const stepLength = defaultStepLength * (step.length?.value ?? 1)
    if (!isPositiveFiniteNumber(stepLength)) {
      continue
    }

    pushStepEvent(events, step, offset, defaultStepLength)
    offset += stepLength
  }

  return {
    length: makeNumeric('beats', offset),
    evaluate: () => events
  }
}

/**
 * Create a pattern where all steps occur simultaneously at time 0.
 * The pattern's length is the maximum length of the provided steps.
 */
export function createParallelPattern (steps: readonly Step[]): Pattern {
  if (steps.length === 0) {
    return emptyPattern
  }

  const events: NoteEvent[] = []
  let maxLength = 0

  for (const step of steps) {
    const stepLength = step.length?.value ?? 1
    if (!isPositiveFiniteNumber(stepLength)) {
      continue
    }

    pushStepEvent(events, step, 0)
    maxLength = Math.max(maxLength, stepLength)
  }

  return {
    length: makeNumeric('beats', maxLength),
    evaluate: () => events
  }
}

/**
 * Concatenate multiple patterns into a single pattern, creating a serial arrangement.
 */
export function concatPatterns (patterns: readonly Pattern[]): Pattern {
  // We only need to consider non-empty patterns, and only up to (and including) the first infinite one.
  const nonEmptyPatterns = patterns.filter((p) => p.length == null || p.length.value > 0)
  const infiniteIndex = nonEmptyPatterns.findIndex((p) => p.length == null)
  const filteredPatterns = infiniteIndex >= 0 ? nonEmptyPatterns.slice(0, infiniteIndex + 1) : nonEmptyPatterns

  if (filteredPatterns.length <= 1) {
    return filteredPatterns.at(0) ?? emptyPattern
  }

  // Precompute offsets for each pattern
  const offsets: number[] = []

  let cumulativeOffset = 0
  for (const pattern of filteredPatterns) {
    offsets.push(cumulativeOffset)
    cumulativeOffset += pattern.length?.value ?? 0
  }

  return {
    length: getSumOfLengths(filteredPatterns),

    evaluate: function* () {
      yield* filteredPatterns[0].evaluate()

      for (let i = 1; i < filteredPatterns.length; ++i) {
        const pattern = filteredPatterns[i]
        const offset = offsets[i]

        for (const event of pattern.evaluate()) {
          yield {
            ...event,
            time: makeNumeric('beats', event.time.value + offset)
          }
        }
      }
    }
  }
}

/**
 * Merge multiple patterns into a single pattern, creating a parallel arrangement.
 */
export function mergePatterns (patterns: readonly Pattern[]): Pattern {
  const nonEmptyPatterns = patterns.filter((p) => p.length == null || p.length.value > 0)
  if (nonEmptyPatterns.length <= 1) {
    return nonEmptyPatterns.at(0) ?? emptyPattern
  }

  return {
    length: getMaxLength(nonEmptyPatterns),

    evaluate: function* () {
      const iterables = nonEmptyPatterns.map((p) => p.evaluate())
      const iterators = iterables.map((it) => it[Symbol.iterator]())
      const nextEvents = iterators.map((it) => it.next())

      for (;;) {
        let earliestTime: number | undefined

        for (const nextEvent of nextEvents) {
          if (!nextEvent.done) {
            const eventTime = nextEvent.value.time.value
            if (earliestTime == null || eventTime < earliestTime) {
              earliestTime = eventTime
            }
          }
        }

        if (earliestTime == null) {
          // all iterators are done
          break
        }

        for (let i = 0; i < nextEvents.length; i++) {
          const nextEvent = nextEvents[i]
          if (!nextEvent.done && nextEvent.value.time.value === earliestTime) {
            yield nextEvent.value
            nextEvents[i] = iterators[i].next()
          }
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

  if (!isPositiveFiniteNumber(duration.value)) {
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
  if (!isPositiveFiniteNumber(times)) {
    return emptyPattern
  }

  return {
    // infinite pattern remains infinite, otherwise scale length
    length: pattern.length != null ? makeNumeric('beats', pattern.length.value * times) : undefined,

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
export function renderPatternEvents (pattern: Pattern, end: Numeric<'beats'>): readonly NoteEvent[] {
  if (!isPositiveFiniteNumber(end.value)) {
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
