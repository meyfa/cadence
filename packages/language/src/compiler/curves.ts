import type { CurvePoint, CurveShape } from '@meyfa/cadence-core'
import { timeToSeconds } from '@meyfa/cadence-core'
import type { Numeric, RuntimeNumeric, Unit } from '@meyfa/cadence-utility'
import type { Curve, CurveDuration, CurveSegment, HoldCurveSegment, LinearCurveSegment } from '../type-system/domain/curve.js'
import { assert, nonNull } from './assert.js'

const SEGMENT_TYPE_HOLD = 'hold'
const SEGMENT_TYPE_LINEAR = 'lin'

const TIME_EPSILON = 1e-6 // 1 microsecond, which is less than 1 sample at 96 kHz

export interface CurveSegmentType {
  readonly type: CurveSegment<any>['type']
  readonly parameterCount: number
  readonly create: <U extends Unit>(parameters: ReadonlyArray<RuntimeNumeric<U>>, length: CurveDuration) => CurveSegment<U>
  readonly start: <U extends Unit>(segment: CurveSegment<U>) => RuntimeNumeric<U>
  readonly end: <U extends Unit>(segment: CurveSegment<U>) => RuntimeNumeric<U>
  readonly endShape: CurveShape
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
    endShape: 'step'
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
    endShape: 'linear'
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
  parameters: ReadonlyArray<RuntimeNumeric<U>>,
  length: CurveDuration
): CurveSegment<U> {
  const definition = nonNull(curveSegmentTypes.get(type), `Unknown curve segment type: ${type}`)
  assert(definition.parameterCount === parameters.length, 'Invalid curve parameters')

  return definition.create(parameters, length)
}

export interface RenderCurveOptions {
  readonly offset: Numeric<'s'>
  readonly limit?: Numeric<'s'>
  readonly tempo: Numeric<'bpm'>
}

export function renderCurvePoints<U extends Unit> (curve: Curve<U>, options: RenderCurveOptions): ReadonlyArray<CurvePoint<'s', U>> {
  const segments = curve.segments
  if (segments.length === 0 || (options.limit != null && options.limit <= 0)) {
    return []
  }

  const points: Array<CurvePoint<'s', U>> = []

  let currentTime = options.offset

  for (const segment of segments) {
    const segmentLength = segment.length.value > 0
      ? timeToSeconds(segment.length, options.tempo)
      : 0 as Numeric<'s'>

    const definition = nonNull(getCurveSegmentType(segment.type), `Unknown curve segment type: ${segment.type}`)

    const startTime = currentTime
    const endTime = currentTime + segmentLength as Numeric<'s'>

    points.push({
      time: startTime,
      value: definition.start(segment).value,
      shape: 'step'
    }, {
      time: endTime,
      value: definition.end(segment).value,
      shape: segmentLength <= 0 ? 'step' : definition.endShape
    })

    currentTime = endTime
  }

  const simplifiedPoints = simplifyCurvePoints(points)

  const endTime = options.limit != null
    ? options.offset + options.limit as Numeric<'s'>
    : undefined

  if (endTime != null && currentTime > endTime) {
    return takePointsBefore(simplifiedPoints, endTime)
  }

  return simplifiedPoints
}

function interpolatePoint<U extends Unit> (start: CurvePoint<'s', U>, end: CurvePoint<'s', U>, time: Numeric<'s'>): CurvePoint<'s', U> {
  assert(time >= start.time && time <= end.time)

  const deltaTime = end.time - start.time
  if (deltaTime < TIME_EPSILON) {
    return { time, value: start.value, shape: 'step' }
  }

  const t = (time - start.time) / deltaTime

  switch (end.shape) {
    case 'step':
      return { time, value: start.value, shape: 'step' }

    case 'linear': {
      const value = (start.value + t * (end.value - start.value)) as Numeric<U>
      return { time, value, shape: 'linear' }
    }

    case 'exponential':
      // TODO implement
      throw new Error('Not implemented')
  }
}

export function mergeCurvePoints<U extends Unit> (
  first: ReadonlyArray<CurvePoint<'s', U>>,
  second: ReadonlyArray<CurvePoint<'s', U>>
): ReadonlyArray<CurvePoint<'s', U>> {
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
  points: ReadonlyArray<CurvePoint<'s', U>>,
  time: Numeric<'s'>
): ReadonlyArray<CurvePoint<'s', U>> {
  const result: Array<CurvePoint<'s', U>> = []

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
  points: ReadonlyArray<CurvePoint<'s', U>>,
  time: Numeric<'s'>
): ReadonlyArray<CurvePoint<'s', U>> {
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
  const difference = left - right
  if (Math.abs(difference) <= TIME_EPSILON) {
    return 0
  }

  return difference < 0 ? -1 : 1
}

function simplifyCurvePoints<U extends Unit> (points: ReadonlyArray<CurvePoint<'s', U>>): ReadonlyArray<CurvePoint<'s', U>> {
  const simplified: Array<CurvePoint<'s', U>> = []

  for (const point of points) {
    const previous = simplified.at(-1)

    if (previous == null || compareTimes(point.time, previous.time) !== 0) {
      simplified.push(point)
      continue
    }

    if (point.value === previous.value) {
      continue
    }

    // not first, same time, different values: the point should be emitted as a step

    // repetitive step points should be avoided
    if (previous.shape === 'step') {
      simplified.pop()
    }

    simplified.push({ ...point, shape: 'step' })
  }

  return simplified
}
