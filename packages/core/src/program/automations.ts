import type { Brand, Numeric, Unit } from '@utility'

export type ParameterId = Brand<number, 'core.ParameterId'>

export interface Parameter<U extends Unit> {
  readonly id: ParameterId
  readonly unit: U
  readonly initial: Numeric<U>
}
