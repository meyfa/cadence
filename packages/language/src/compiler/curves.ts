import type { AutomationPoint } from '@core'
import { timeToSeconds } from '@core'
import type { Numeric, Unit } from '@utility'
import { numeric } from '@utility'
import type { Curve, CurveDuration, CurveSegment, HoldCurveSegment, LinearCurveSegment } from '../type-system/domain/curve.js'
import { assert, nonNull } from './assert.js'

const SEGMENT_TYPE_HOLD = 'hold'
const SEGMENT_TYPE_LINEAR = 'lin'

const ZERO_SECONDS = numeric('s', 0)

const TIME_EPSILON = 1e-6 // 1 microsecond, which is less than 1 sample at 96 kHz

export interface CurveSegmentType {
  readonly type: CurveSegment<any>['type']
  readonly parameterCount: number
  readonly create: <U extends Unit>(parameters: ReadonlyArray<Numeric<U>>, length: CurveDuration) => CurveSegment<U>
  readonly start: <U extends Unit>(segment: CurveSegment<U>) => Numeric<U>
  readonly end: <U extends Unit>(segment: CurveSegment<U>) => Numeric<U>
  readonly endCurve: AutomationPoint<any>['curve']
}

const curveSegmentTypes: ReadonlyMap<string, CurveSegmentType> = new Map([
  [SEGMENT_TYPE_HOLD, {
    type: SEGMENT_TYPE_HOLD,
    parameterCount: 1,
    create: (parameters, length) => {
      const [value] = parameters
      return { type: SEGMENT_TYPE_HOLD, length, unit: value.unit, value }
    },
    start: <U extends Unit>(segment: CurveSegment<U>) => (segment as HoldCurveSegment<U>).value,
    end: <U extends Unit>(segment: CurveSegment<U>) => (segment as HoldCurveSegment<U>).value,
    endCurve: 'step'
  }],

  [SEGMENT_TYPE_LINEAR, {
    type: SEGMENT_TYPE_LINEAR,
    parameterCount: 2,
    create: (parameters, length) => {
      const [start, end] = parameters
      return { type: SEGMENT_TYPE_LINEAR, length, unit: start.unit, start, end }
    },
    start: <U extends Unit>(segment: CurveSegment<U>) => (segment as LinearCurveSegment<U>).start,
    end: <U extends Unit>(segment: CurveSegment<U>) => (segment as LinearCurveSegment<U>).end,
    endCurve: 'linear'
  }]
])

export function getCurveSegmentType (type: string): CurveSegmentType | undefined {
  return curveSegmentTypes.get(type)
}

export function createCurve<U extends Unit> (segments: ReadonlyArray<CurveSegment<U>>): Curve<U> {
  const unit = segments.at(0)?.unit as U
  return { unit, segments }
}

export function createCurveSegment<U extends Unit> (
  type: string,
  parameters: ReadonlyArray<Numeric<U>>,
  length: CurveDuration
): CurveSegment<U> {
  const definition = nonNull(curveSegmentTypes.get(type), `Unknown curve segment type: ${type}`)
  assert(definition.parameterCount === parameters.length, 'Invalid curve parameters')

  return definition.create(parameters, length)
}

export interface RenderCurveOptions {
  readonly offset: CurveDuration
  readonly limit?: CurveDuration
  readonly tempo: Numeric<'bpm'>
}

export function renderCurvePoints<U extends Unit> (curve: Curve<U>, options: RenderCurveOptions): ReadonlyArray<AutomationPoint<U>> {
  const segments = curve.segments
  if (segments.length === 0 || (options.limit != null && options.limit.value <= 0)) {
    return []
  }

  const points: Array<AutomationPoint<U>> = []

  const offsetSeconds = timeToSeconds(options.offset, options.tempo)
  let currentTime: Numeric<'s'> = offsetSeconds

  for (const segment of segments) {
    const segmentLength = segment.length.value > 0
      ? timeToSeconds(segment.length, options.tempo)
      : ZERO_SECONDS

    const definition = nonNull(getCurveSegmentType(segment.type), `Unknown curve segment type: ${segment.type}`)

    const startTime = currentTime
    const endTime = numeric('s', currentTime.value + segmentLength.value)

    points.push({
      time: startTime,
      value: definition.start(segment),
      curve: 'step'
    }, {
      time: endTime,
      value: definition.end(segment),
      curve: segmentLength.value <= 0 ? 'step' : definition.endCurve
    })

    currentTime = endTime
  }

  const simplifiedPoints = simplifyCurvePoints(points)

  const endTime = options.limit != null
    ? numeric('s', offsetSeconds.value + timeToSeconds(options.limit, options.tempo).value)
    : undefined

  if (endTime != null && currentTime.value > endTime.value) {
    return takePointsBefore(simplifiedPoints, endTime)
  }

  return simplifiedPoints
}

function interpolatePoint<U extends Unit> (start: AutomationPoint<U>, end: AutomationPoint<U>, time: Numeric<'s'>): AutomationPoint<U> {
  assert(time.value >= start.time.value && time.value <= end.time.value)

  const deltaTime = end.time.value - start.time.value
  if (deltaTime < TIME_EPSILON) {
    return { time, value: start.value, curve: 'step' }
  }

  const t = (time.value - start.time.value) / deltaTime

  switch (end.curve) {
    case 'step':
      return { time, value: start.value, curve: 'step' }

    case 'linear': {
      const value = {
        unit: start.value.unit,
        value: start.value.value + t * (end.value.value - start.value.value)
      }
      return { time, value, curve: 'linear' }
    }
  }
}

export function mergeCurvePoints<U extends Unit> (
  first: ReadonlyArray<AutomationPoint<U>>,
  second: ReadonlyArray<AutomationPoint<U>>
): ReadonlyArray<AutomationPoint<U>> {
  if (first.length === 0) {
    return second
  }

  if (second.length === 0) {
    return first
  }

  const start = second[0].time
  const end = second.at(-1)?.time

  assert(end != null)

  return simplifyCurvePoints([
    ...takePointsBefore(first, start),
    ...second,
    ...takePointsAfter(first, end)
  ])
}

function takePointsBefore<U extends Unit> (
  points: ReadonlyArray<AutomationPoint<U>>,
  time: Numeric<'s'>
): ReadonlyArray<AutomationPoint<U>> {
  const result: Array<AutomationPoint<U>> = []

  for (let i = 0; i < points.length; ++i) {
    const point = points[i]

    const pointComparison = compareTimes(point.time, time)
    if (pointComparison < 0) {
      result.push(point)
      continue
    }

    const previous = i > 0 ? points[i - 1] : undefined

    if (pointComparison === 0) {
      if (previous != null && compareTimes(previous.time, time) < 0) {
        result.push(point)
      }
      break
    }

    if (previous != null && compareTimes(previous.time, time) < 0) {
      result.push(interpolatePoint(previous, point, time))
    }

    break
  }

  return result
}

function takePointsAfter<U extends Unit> (
  points: ReadonlyArray<AutomationPoint<U>>,
  time: Numeric<'s'>
): ReadonlyArray<AutomationPoint<U>> {
  for (let i = 0; i < points.length; ++i) {
    const point = points[i]

    const pointComparison = compareTimes(point.time, time)
    if (pointComparison < 0) {
      continue
    }

    if (pointComparison === 0) {
      return i < points.length - 1 ? points.slice(i) : []
    }

    const previous = i > 0 ? points[i - 1] : undefined
    if (previous != null && compareTimes(previous.time, time) < 0) {
      return [interpolatePoint(previous, point, time), ...points.slice(i)]
    }

    return points.slice(i)
  }

  return []
}

function compareTimes (left: Numeric<'s'>, right: Numeric<'s'>): number {
  const difference = left.value - right.value
  if (Math.abs(difference) <= TIME_EPSILON) {
    return 0
  }

  return difference < 0 ? -1 : 1
}

function simplifyCurvePoints<U extends Unit> (points: ReadonlyArray<AutomationPoint<U>>): ReadonlyArray<AutomationPoint<U>> {
  const simplified: Array<AutomationPoint<U>> = []

  for (const point of points) {
    const previous = simplified.at(-1)

    if (previous == null || compareTimes(point.time, previous.time) !== 0) {
      simplified.push(point)
      continue
    }

    if (point.value.value === previous.value.value) {
      continue
    }

    // not first, same time, different values: the point should be emitted as a step

    // repetitive step points should be avoided
    if (previous.curve === 'step') {
      simplified.pop()
    }

    simplified.push({ ...point, curve: 'step' })
  }

  return simplified
}
