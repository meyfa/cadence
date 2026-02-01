import type { AutomationPoint, Numeric, Unit } from '@core/program.js'

export type Curve<U extends Unit> = HoldCurve<U> | LinearCurve<U>

export interface HoldCurve<U extends Unit> {
  readonly type: 'hold'
  readonly unit: U
  readonly value: Numeric<U>
}

export interface LinearCurve<U extends Unit> {
  readonly type: 'linear'
  readonly unit: U
  readonly start: Numeric<U>
  readonly end: Numeric<U>
}

export const curveParameterCounts = new Map<string, number>([
  ['hold', 1],
  ['linear', 2]
])

export function createCurve<U extends Unit> (type: string, parameters: ReadonlyArray<Numeric<U>>): Curve<U> | undefined {
  if (curveParameterCounts.get(type) !== parameters.length) {
    throw new Error('Invalid curve parameters')
  }

  const unit = parameters.at(0)?.unit as U

  switch (type) {
    case 'hold': {
      const [value] = parameters
      return { type: 'hold', unit, value }
    }

    case 'linear': {
      const [start, end] = parameters
      return { type: 'linear', unit, start, end }
    }

    default:
      throw new Error(`Unknown curve type: ${type}`)
  }
}

export function renderCurvePoints<U extends Unit> (curve: Curve<U>, timeStart: Numeric<'beats'>, timeEnd: Numeric<'beats'>): ReadonlyArray<AutomationPoint<U>> {
  switch (curve.type) {
    case 'hold':
      return [
        { time: timeStart, value: curve.value, curve: 'step' },
        { time: timeEnd, value: curve.value, curve: 'step' }
      ]

    case 'linear':
      return [
        { time: timeStart, value: curve.start, curve: 'step' },
        { time: timeEnd, value: curve.end, curve: 'linear' }
      ]
  }
}
