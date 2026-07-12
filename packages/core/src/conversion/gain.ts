import type { RuntimeNumeric } from '@utility'
import { runtimeNumeric } from '@utility'

export function dbToGain ({ value }: RuntimeNumeric<'db'>): RuntimeNumeric<undefined> {
  if (Number.isNaN(value) || (value > 0 && !Number.isFinite(value))) {
    throw new Error(`Invalid gain: ${value}`)
  }

  return runtimeNumeric(undefined, Math.pow(10, value / 20))
}

export function gainToDb ({ value }: RuntimeNumeric<undefined>): RuntimeNumeric<'db'> {
  if (value <= 0) {
    return runtimeNumeric('db', -Infinity)
  }

  return runtimeNumeric('db', 20 * Math.log10(value))
}
