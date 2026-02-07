import type { Unit } from '@core/program.js'
import { NumberType, type NumberValue } from './types.js'

interface Constants {
  readonly beatsPerBar: number
}

export const SyntaxUnits = ['bpm', 'bars', 'beats', 's', 'ms', 'hz', 'db'] as const
export type SyntaxUnit = typeof SyntaxUnits[number]

export function isSyntaxUnit (value: string): value is SyntaxUnit {
  return SyntaxUnits.includes(value as SyntaxUnit)
}

export function toNumberValue (constants: Constants, unit: SyntaxUnit | undefined, value: number): NumberValue {
  switch (unit) {
    case undefined:
    case 'bpm':
    case 'db':
    case 'hz':
    case 's':
    case 'beats':
      return NumberType.of({ unit, value })
    case 'ms':
      return NumberType.of({ unit: 's', value: value / 1000 })
    case 'bars':
      return NumberType.of({ unit: 'beats', value: value * constants.beatsPerBar })
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
    case 'beats':
      return unit
    case 'ms':
      return 's'
    case 'bars':
      return 'beats'
  }
}
