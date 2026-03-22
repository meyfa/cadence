import { beatsToSeconds, numeric, type AutomationPoint, type Numeric, type Parameter, type Program, type Unit } from '@core'
import { dbToGain } from './constants.js'

export type Curve = 'step' | 'linear' | 'exponential'

export interface TimeVariant<U extends Unit> {
  readonly initial: Numeric<U>
  readonly points: ReadonlyArray<TimeVariantPoint<U>>
}

export interface TimeVariantPoint<U extends Unit> {
  readonly time: Numeric<'s'>
  readonly value: Numeric<U>

  /**
   * The curve from the previous point, or from the initial value, to this point.
   */
  readonly curve: Curve
}

export function timeVariant<const U extends Unit> (initial: Numeric<U>, points: ReadonlyArray<TimeVariantPoint<U>>): TimeVariant<U> {
  return { initial, points }
}

export interface Transform<FromUnit extends Unit, ToUnit extends Unit> {
  readonly transformValue: (value: Numeric<FromUnit>) => Numeric<ToUnit>
  readonly transformCurve: (curve: Curve) => Curve
}

export function toTimeVariant<FromUnit extends Unit, ToUnit extends Unit = FromUnit> (
  parameter: Parameter<FromUnit>,
  program: Program,
  transform: Transform<FromUnit, ToUnit>
): TimeVariant<ToUnit> {
  const initial = parameter.initial
  const points = (program.automations.get(parameter.id)?.points ?? []) as ReadonlyArray<AutomationPoint<FromUnit>>

  return {
    initial: transform.transformValue(initial),
    points: points.map((point) => ({
      time: beatsToSeconds(point.time, program.track.tempo),
      value: transform.transformValue(point.value),
      curve: transform.transformCurve(point.curve)
    }))
  }
}

export function identityTransform<U extends Unit> (): Transform<U, U> {
  return {
    transformValue: (value) => value,
    transformCurve: (curve) => curve
  }
}

export const gainTransform: Transform<'db', undefined> = {
  transformValue: (value) => {
    return numeric(undefined, dbToGain(value.value))
  },

  transformCurve: (curve) => {
    switch (curve) {
      case 'step':
        return 'step'
      case 'linear':
        return 'exponential'
      case 'exponential':
        throw new Error()
    }
  }
}
