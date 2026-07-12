import type { Numeric } from '@utility'
import type { NoteEvent, Pattern, Step } from './types.js'

const zeroBeats = 0 as Numeric<'beats'>
const defaultVelocity = 1 as Numeric<undefined>

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
    sum += pattern.length
  }

  return sum as Numeric<'beats'>
}

function getMaxLength (patterns: readonly Pattern[]): Pattern['length'] {
  let max = 0

  for (const pattern of patterns) {
    if (pattern.length == null) {
      return undefined
    }
    max = Math.max(max, pattern.length)
  }

  return max as Numeric<'beats'>
}

function pushStepEvent (events: NoteEvent[], step: Step, time: Numeric<'beats'>): void {
  if (step.value === '-') {
    return
  }

  const gate = step.gate ?? step.length ?? 1 as Numeric<'beats'>
  const velocity = step.velocity ?? defaultVelocity

  events.push(
    step.value === 'x'
      ? { time, gate, velocity }
      : { time, gate, pitch: step.value, velocity }
  )
}

/**
 * Create a pattern with equally spaced steps, where each step is 1 beat long.
 */
export function createSerialPattern (steps: readonly Step[]): Pattern {
  if (steps.length === 0) {
    return emptyPattern
  }

  const events: NoteEvent[] = []
  let offset = 0 as Numeric<'beats'>

  for (const step of steps) {
    const stepLength = step.length ?? 1
    if (!isPositiveFiniteNumber(stepLength)) {
      continue
    }

    pushStepEvent(events, step, offset)
    offset = offset + stepLength as Numeric<'beats'>
  }

  return {
    length: offset,
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
  let maxLength = 0 as Numeric<'beats'>

  for (const step of steps) {
    const stepLength = step.length ?? 1
    if (!isPositiveFiniteNumber(stepLength)) {
      continue
    }

    pushStepEvent(events, step, 0 as Numeric<'beats'>)
    maxLength = Math.max(maxLength, stepLength) as Numeric<'beats'>
  }

  return {
    length: maxLength,
    evaluate: () => events
  }
}

/**
 * Concatenate multiple patterns into a single pattern, creating a serial arrangement.
 */
export function concatPatterns (patterns: readonly Pattern[]): Pattern {
  // We only need to consider non-empty patterns, and only up to (and including) the first infinite one.
  const nonEmptyPatterns = patterns.filter((p) => p.length == null || p.length > 0)
  const infiniteIndex = nonEmptyPatterns.findIndex((p) => p.length == null)
  const filteredPatterns = infiniteIndex >= 0 ? nonEmptyPatterns.slice(0, infiniteIndex + 1) : nonEmptyPatterns

  if (filteredPatterns.length <= 1) {
    return filteredPatterns.at(0) ?? emptyPattern
  }

  // Precompute offsets for each pattern
  const offsets: Array<Numeric<'beats'>> = []

  let cumulativeOffset = 0 as Numeric<'beats'>
  for (const pattern of filteredPatterns) {
    offsets.push(cumulativeOffset)
    cumulativeOffset = cumulativeOffset + (pattern.length ?? 0) as Numeric<'beats'>
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
            time: event.time + offset as Numeric<'beats'>
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
  const nonEmptyPatterns = patterns.filter((p) => p.length == null || p.length > 0)
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
            const eventTime = nextEvent.value.time
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
          if (!nextEvent.done && nextEvent.value.time === earliestTime) {
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
  const patternLength = pattern.length

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
              time: event.time + offset as Numeric<'beats'>
            }
          }

          offset += patternLength
        } while (hasEvents)
      }
    }
  }

  if (!isPositiveFiniteNumber(duration)) {
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
          const time = offset + event.time as Numeric<'beats'>
          if (time >= duration) {
            return
          }

          const remainingDuration = duration - time as Numeric<'beats'>
          const gate = event.gate != null && event.gate > remainingDuration
            ? remainingDuration
            : event.gate

          hasEvents = true
          yield { ...event, time, gate }
        }

        // will only get here if pattern is finite
        offset += patternLength ?? 0
      } while (hasEvents)
    }
  }
}

/**
 * Multiply a pattern by a runtimeNumeric factor, keeping the sequence of events the same but adjusting their timing.
 *
 * For example, multiplying a pattern of length 2 by 3 will produce a pattern of length 6 where each event occurs
 * at three times the original time.
 *
 * The factor must be strictly positive (> 0), otherwise an empty pattern is returned.
 */
export function multiplyPattern (pattern: Pattern, times: number): Pattern {
  // empty pattern remains empty
  if (pattern.length != null && pattern.length <= 0) {
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
    length: pattern.length != null ? pattern.length * times as Numeric<'beats'> : undefined,

    evaluate: function* () {
      for (const event of pattern.evaluate()) {
        yield {
          ...event,
          time: event.time * times as Numeric<'beats'>,
          gate: event.gate != null ? event.gate * times as Numeric<'beats'> : undefined
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
  if (!isPositiveFiniteNumber(end)) {
    return []
  }

  const events: NoteEvent[] = []

  for (const event of pattern.evaluate()) {
    if (event.time >= end) {
      break
    }

    const remainingDuration = end - event.time as Numeric<'beats'>
    const gate = event.gate != null && event.gate > remainingDuration
      ? remainingDuration
      : event.gate

    events.push({ ...event, gate })
  }

  return events
}
