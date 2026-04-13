import type { AutomationPoint } from '@core'
import type { Numeric, Unit } from '@utility'

const CURVE_HOLD = 'hold'
const CURVE_LINEAR = 'lin'

export type Curve<U extends Unit> = HoldCurve<U> | LinearCurve<U>

export interface HoldCurve<U extends Unit> {
  readonly type: typeof CURVE_HOLD
  readonly unit: U
  readonly value: Numeric<U>
}

export interface LinearCurve<U extends Unit> {
  readonly type: typeof CURVE_LINEAR
  readonly unit: U
  readonly start: Numeric<U>
  readonly end: Numeric<U>
}

export const curveParameterCounts = new Map<string, number>([
  [CURVE_HOLD, 1],
  [CURVE_LINEAR, 2]
])

export function createCurve<U extends Unit> (type: string, parameters: ReadonlyArray<Numeric<U>>): Curve<U> | undefined {
  if (curveParameterCounts.get(type) !== parameters.length) {
    throw new Error('Invalid curve parameters')
  }

  const unit = parameters.at(0)?.unit as U

  switch (type) {
    case CURVE_HOLD: {
      const [value] = parameters
      return { type: CURVE_HOLD, unit, value }
    }

    case CURVE_LINEAR: {
      const [start, end] = parameters
      return { type: CURVE_LINEAR, unit, start, end }
    }

    default:
      throw new Error(`Unknown curve type: ${type}`)
  }
}

export function renderCurvePoints<U extends Unit> (curve: Curve<U>, timeStart: Numeric<'beats'>, timeEnd: Numeric<'beats'>): ReadonlyArray<AutomationPoint<U>> {
  switch (curve.type) {
    case CURVE_HOLD:
      return [
        { time: timeStart, value: curve.value, curve: 'step' },
        { time: timeEnd, value: curve.value, curve: 'step' }
      ]

    case CURVE_LINEAR:
      return [
        { time: timeStart, value: curve.start, curve: 'step' },
        { time: timeEnd, value: curve.end, curve: 'linear' }
      ]
  }
}
