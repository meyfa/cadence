import type { Brand, Unit, Numeric } from '@utility'

export type ParameterId = Brand<number, 'core.ParameterId'>

export interface Parameter<U extends Unit> {
  readonly id: ParameterId
  readonly initial: Numeric<U>
}

export interface Automation<U extends Unit = Unit> {
  readonly parameterId: ParameterId
  readonly points: ReadonlyArray<AutomationPoint<U>>
}

export interface AutomationPoint<U extends Unit = Unit> {
  readonly time: Numeric<'s'>
  readonly value: Numeric<U>

  /**
   * The curve from the previous point, or from the initial value, to this point.
   */
  readonly curve: 'linear' | 'step'
}
