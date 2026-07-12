import type { Numeric, Unit } from '@utility'

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
