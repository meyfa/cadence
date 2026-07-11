import type { Numeric } from '@utility'
import { numeric } from '@utility'

export function dbToGain ({ value }: Numeric<'db'>): Numeric<undefined> {
  if (Number.isNaN(value) || (value > 0 && !Number.isFinite(value))) {
    throw new Error(`Invalid gain: ${value}`)
  }

  return numeric(undefined, Math.pow(10, value / 20))
}

export function gainToDb ({ value }: Numeric<undefined>): Numeric<'db'> {
  if (value <= 0) {
    return numeric('db', -Infinity)
  }

  return numeric('db', 20 * Math.log10(value))
}
