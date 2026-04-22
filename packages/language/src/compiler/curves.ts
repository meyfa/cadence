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

export interface CurveSegmentType {
  readonly type: CurveSegment<any>['type']
  readonly parameterCount: number
  readonly create: <U extends Unit>(parameters: ReadonlyArray<Numeric<U>>, length: Numeric<undefined>) => CurveSegment<U>
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
  length = numeric(undefined, 1)
): CurveSegment<U> {
  const definition = curveSegmentTypes.get(type)
  if (definition == null) {
    throw new Error(`Unknown curve type: ${type}`)
  }

  if (definition.parameterCount !== parameters.length) {
    throw new Error('Invalid curve parameters')
  }

  return definition.create(parameters, length)
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
      return timeStart
    }
    return numeric('beats', timeStart.value + totalDuration * (weight / totalWeight))
  }

  const points: Array<AutomationPoint<U>> = []
  let currentWeight = 0

  for (let i = 0; i < segments.length; ++i) {
    const segment = segments[i]
    const segmentWeight = segmentWeights[i]

    const definition = getCurveSegmentType(segment.type)
    if (definition == null) {
      throw new Error(`Unknown curve segment type: ${segment.type}`)
    }

    points.push({
      time: getTimeAtWeight(currentWeight),
      value: definition.start(segment),
      curve: 'step'
    }, {
      time: getTimeAtWeight(i === segments.length - 1 ? totalWeight : currentWeight + segmentWeight),
      value: definition.end(segment),
      curve: segmentWeight <= 0 ? 'step' : definition.endCurve
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
