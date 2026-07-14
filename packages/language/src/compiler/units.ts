import type { Numeric, Unit } from '@meyfa/cadence-utility'
import type { Value } from '../type-system/types.ts'
import { Numbers } from '../type-system/helpers.ts'

interface Constants {
  readonly beatsPerBar: number
}

export const SyntaxUnits = [
  'bpm',
  'db',
  'hz',
  's',
  'ms',
  'beat',
  'beats',
  'bar',
  'bars'
] as const

export type SyntaxUnit = typeof SyntaxUnits[number]

export function isSyntaxUnit (value: string): value is SyntaxUnit {
  return SyntaxUnits.includes(value as SyntaxUnit)
}

export function toNumberValue (constants: Constants, unit: SyntaxUnit | undefined, value: number): Value {
  switch (unit) {
    case undefined:
    case 'bpm':
    case 'db':
    case 'hz':
    case 's':
      return Numbers.of({ unit, value: value as Numeric<typeof unit> })
    case 'ms':
      return Numbers.of({ unit: 's', value: (value / 1000) as Numeric<'s'> })
    case 'beat':
    case 'beats':
      return Numbers.of({ unit: 'beats', value: value as Numeric<'beats'> })
    case 'bar':
    case 'bars':
      return Numbers.of({ unit: 'beats', value: (value * constants.beatsPerBar) as Numeric<'beats'> })
  }
}

/**
 * Convert from the user-facing (syntax) unit to the base unit used internally.
 */
export function toBaseUnit (unit: SyntaxUnit | undefined): Unit {
  switch (unit) {
    case undefined:
    case 'bpm':
    case 'db':
    case 'hz':
    case 's':
      return unit
    case 'ms':
      return 's'
    case 'beat':
    case 'beats':
      return 'beats'
    case 'bar':
    case 'bars':
      return 'beats'
  }
}
