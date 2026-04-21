import type { AutomationPoint } from '@core'
import type { Numeric, Unit } from '@utility'
import { numeric } from '@utility'

const SEGMENT_TYPE_HOLD = 'hold'
const SEGMENT_TYPE_LINEAR = 'lin'

export interface Curve<U extends Unit> {
  readonly unit: U
  readonly segments: ReadonlyArray<CurveSegment<U>>
}

export type CurveSegment<U extends Unit> = HoldCurveSegment<U> | LinearCurveSegment<U>

export interface HoldCurveSegment<U extends Unit> {
  readonly type: typeof SEGMENT_TYPE_HOLD
  readonly length: Numeric<undefined>
  readonly unit: U
  readonly value: Numeric<U>
}

export interface LinearCurveSegment<U extends Unit> {
  readonly type: typeof SEGMENT_TYPE_LINEAR
  readonly length: Numeric<undefined>
  readonly unit: U
  readonly start: Numeric<U>
  readonly end: Numeric<U>
}

export const curveParameterCounts = new Map<string, number>([
  [SEGMENT_TYPE_HOLD, 1],
  [SEGMENT_TYPE_LINEAR, 2]
])

export function createCurve<U extends Unit> (segments: ReadonlyArray<CurveSegment<U>>): Curve<U> {
  const unit = segments.at(0)?.unit as U
  return { unit, segments }
}

export function createCurveSegment<U extends Unit> (
  type: string,
  parameters: ReadonlyArray<Numeric<U>>,
  length = numeric(undefined, 1)
): CurveSegment<U> {
  if (curveParameterCounts.get(type) !== parameters.length) {
    throw new Error('Invalid curve parameters')
  }

  const unit = parameters.at(0)?.unit as U

  switch (type) {
    case SEGMENT_TYPE_HOLD: {
      const [value] = parameters
      return { type, length, unit, value }
    }

    case SEGMENT_TYPE_LINEAR: {
      const [start, end] = parameters
      return { type, length, unit, start, end }
    }

    default:
      throw new Error(`Unknown curve type: ${type}`)
  }
}

export function renderCurvePoints<U extends Unit> (curve: Curve<U>, timeStart: Numeric<'beats'>, timeEnd: Numeric<'beats'>): ReadonlyArray<AutomationPoint<U>> {
  const segments = curve.segments
  if (segments.length === 0) {
    return []
  }

  const totalDuration = timeEnd.value - timeStart.value
  const segmentWeights = segments.map((segment) => Math.max(segment.length.value, 0))
  const totalWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0)

  const getTimeAtWeight = (weight: number) => {
    if (totalWeight === 0) {
      return timeStart.value
    }
    return timeStart.value + totalDuration * (weight / totalWeight)
  }

  const points: Array<AutomationPoint<U>> = []
  let currentWeight = 0

  for (let i = 0; i < segments.length; ++i) {
    const segment = segments[i]
    const segmentWeight = segmentWeights[i]

    const segmentStart = getTimeAtWeight(currentWeight)
    const segmentEnd = i === segments.length - 1
      ? getTimeAtWeight(totalWeight)
      : getTimeAtWeight(currentWeight + segmentWeight)

    const endCurve = segment.type === SEGMENT_TYPE_LINEAR && segmentWeight > 0
      ? 'linear'
      : 'step'

    points.push({
      time: numeric('beats', segmentStart),
      value: segment.type === SEGMENT_TYPE_LINEAR ? segment.start : segment.value,
      curve: 'step'
    }, {
      time: numeric('beats', segmentEnd),
      value: segment.type === SEGMENT_TYPE_LINEAR ? segment.end : segment.value,
      curve: endCurve
    })

    currentWeight += segmentWeight
  }

  return simplifyCurvePoints(points)
}

function simplifyCurvePoints<U extends Unit> (points: ReadonlyArray<AutomationPoint<U>>): ReadonlyArray<AutomationPoint<U>> {
  // Note: This assumes exact floating point equality, which works since the start/end times are calculated
  // using the same formula.

  const simplified: Array<AutomationPoint<U>> = []

  for (const point of points) {
    const previous = simplified.at(-1)
    if (previous == null || point.time.value !== previous.time.value || point.value.value !== previous.value.value) {
      simplified.push(point)
    }
  }

  return simplified
}
