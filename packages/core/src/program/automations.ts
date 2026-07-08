import type { Brand, Unit, Numeric } from '@utility'

export type ParameterId = Brand<number, 'core.ParameterId'>

export interface Parameter<U extends Unit> {
  readonly id: ParameterId
  readonly initial: Numeric<U>
}
