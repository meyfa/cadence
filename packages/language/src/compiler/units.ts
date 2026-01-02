import type { Unit } from '@core/program.js'
import * as ast from '../parser/ast.js'
import { NumberType, type NumberValue } from './types.js'

interface Constants {
  readonly beatsPerBar: number
}

export function toNumberValue (constants: Constants, literal: ast.NumberLiteral): NumberValue {
  switch (literal.unit) {
    case undefined:
    case 'bpm':
    case 'db':
    case 'hz':
    case 's':
    case 'beats':
      return NumberType.of({ unit: literal.unit, value: literal.value })
    case 'ms':
      return NumberType.of({ unit: 's', value: literal.value / 1000 })
    case 'bars':
      return NumberType.of({ unit: 'beats', value: literal.value * constants.beatsPerBar })
  }
}

/**
 * Convert from the user-facing (syntax) unit to the base unit used internally.
 */
export function toBaseUnit (unit: ast.Unit | undefined): Unit {
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
