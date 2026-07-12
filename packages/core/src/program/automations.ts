import type { Brand, Unit, RuntimeNumeric } from '@utility'

export type ParameterId = Brand<number, 'core.ParameterId'>

export interface Parameter<U extends Unit> {
  readonly id: ParameterId
  readonly initial: RuntimeNumeric<U>
}
