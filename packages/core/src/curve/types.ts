import type { RuntimeNumeric, Unit } from '@utility'

export type CurveShape = 'step' | 'linear' | 'exponential'

export interface Curve<T extends Unit, U extends Unit> {
  readonly initial: RuntimeNumeric<U>
  readonly points: ReadonlyArray<CurvePoint<T, U>>
}

export interface CurvePoint<T extends Unit, U extends Unit> {
  readonly time: RuntimeNumeric<T>
  readonly value: RuntimeNumeric<U>

  /**
   * The shape of the line from the previous point, or from the initial value,
   * to this point.
   */
  readonly shape: CurveShape
}
