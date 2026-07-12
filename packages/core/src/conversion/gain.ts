import type { Numeric } from '@utility'

export function dbToGain (value: Numeric<'db'>): Numeric<undefined> {
  if (Number.isNaN(value) || (value > 0 && !Number.isFinite(value))) {
    throw new Error(`Invalid gain: ${value}`)
  }

  return Math.pow(10, value / 20) as Numeric<undefined>
}

export function gainToDb (value: Numeric<undefined>): Numeric<'db'> {
  if (value <= 0) {
    return -Infinity as Numeric<'db'>
  }

  return (20 * Math.log10(value)) as Numeric<'db'>
}
