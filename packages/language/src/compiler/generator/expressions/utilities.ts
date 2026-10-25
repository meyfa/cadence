import type { Numeric, RuntimeNumeric, Unit } from '@meyfa/cadence-utility'

export function clamped<U extends Unit> (value: RuntimeNumeric<U>, minimum: number, maximum: number): RuntimeNumeric<U> {
  if (value.value >= minimum && value.value <= maximum) {
    return value
  }

  return {
    unit: value.unit,
    value: Math.min(Math.max(value.value, minimum), maximum) as Numeric<U>
  }
}
