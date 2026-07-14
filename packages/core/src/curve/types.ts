import type { Numeric, RuntimeNumeric, Unit } from '@meyfa/cadence-utility'

// relative (as specified in the program)

export type CurveDuration = RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>

export interface RelativeCurve<U extends Unit> {
  readonly unit: U
  readonly segments: ReadonlyArray<RelativeCurveSegment<U>>
}

export type RelativeCurveSegment<U extends Unit> = HoldSegment<U> | LinearSegment<U>

export interface HoldSegment<U extends Unit> {
  readonly type: 'hold'
  readonly length: CurveDuration
  readonly unit: U
  readonly value: RuntimeNumeric<U>
}

export interface LinearSegment<U extends Unit> {
  readonly type: 'lin'
  readonly length: CurveDuration
  readonly unit: U
  readonly start: RuntimeNumeric<U>
  readonly end: RuntimeNumeric<U>
}

// absolute (rendered)

export type CurveShape = 'step' | 'linear' | 'exponential'

export interface Curve<T extends Unit, U extends Unit> {
  readonly initial: Numeric<U>
  readonly points: ReadonlyArray<CurvePoint<T, U>>
}

export interface CurvePoint<T extends Unit, U extends Unit> {
  readonly time: Numeric<T>
  readonly value: Numeric<U>

  /**
   * The shape of the line from the previous point, or from the initial value,
   * to this point.
   */
  readonly shape: CurveShape
}
