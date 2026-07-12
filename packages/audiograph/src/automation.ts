import type { Curve, CurvePoint, CurveShape, Parameter, Program } from '@core'
import { dbToGain } from '@core'
import type { Numeric, Unit } from '@utility'

export interface Transform<FromUnit extends Unit, ToUnit extends Unit> {
  readonly transformValue: (value: Numeric<FromUnit>) => Numeric<ToUnit>
  readonly transformCurveShape: (curve: CurveShape) => CurveShape
}

export function computeParameterCurve<FromUnit extends Unit, ToUnit extends Unit = FromUnit> (
  parameter: Parameter<FromUnit>,
  program: Program,
  transform: Transform<FromUnit, ToUnit>
): Curve<'s', ToUnit> {
  const initial = parameter.initial
  const points = (program.automations.get(parameter.id)?.points ?? []) as ReadonlyArray<CurvePoint<'s', FromUnit>>

  return {
    initial: transform.transformValue(initial),
    points: points.map((point) => ({
      time: point.time,
      value: transform.transformValue(point.value),
      shape: transform.transformCurveShape(point.shape)
    }))
  }
}

export function transformCurve<FromUnit extends Unit, ToUnit extends Unit> (
  curve: Curve<'s', FromUnit>,
  transform: Transform<FromUnit, ToUnit>
): Curve<'s', ToUnit> {
  return {
    initial: transform.transformValue(curve.initial),
    points: curve.points.map((point) => ({
      time: point.time,
      value: transform.transformValue(point.value),
      shape: transform.transformCurveShape(point.shape)
    }))
  }
}

export function identityTransform<U extends Unit> (): Transform<U, U> {
  return {
    transformValue: (value) => value,
    transformCurveShape: (curve) => curve
  }
}

export const gainTransform: Transform<'db', undefined> = {
  transformValue: (value) => {
    return dbToGain(value)
  },

  transformCurveShape: (curve) => {
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

export const panTransform: Transform<undefined, undefined> = {
  transformValue: (value) => {
    if (Number.isNaN(value)) {
      throw new Error(`Invalid pan: ${value}`)
    }

    return Math.max(-1, Math.min(1, value)) as Numeric<undefined>
  },

  transformCurveShape: (curve) => curve
}

export const feedbackTransform: Transform<undefined, undefined> = {
  transformValue: (value) => {
    if (Number.isNaN(value)) {
      throw new Error(`Invalid feedback: ${value}`)
    }

    return Math.max(0, Math.min(1, value)) as Numeric<undefined>
  },

  transformCurveShape: (curve) => curve
}

export const frequencyTransform: Transform<'hz', 'hz'> = {
  transformValue: (value) => {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid frequency: ${value}`)
    }

    if (value < 0) {
      return 0 as Numeric<'hz'>
    }

    return value
  },

  transformCurveShape: (curve) => curve
}
