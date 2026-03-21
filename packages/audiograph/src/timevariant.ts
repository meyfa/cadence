import type { Numeric, Unit } from '@core/numeric.js'

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
  readonly curve: 'linear' | 'step'
}

export function timeVariant<const U extends Unit> (initial: Numeric<U>, points: ReadonlyArray<TimeVariantPoint<U>>): TimeVariant<U> {
  return { initial, points }
}
