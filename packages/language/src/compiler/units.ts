import type { Unit } from '@core/program.js'
import * as ast from '../parser/ast.js'
import { NumberType, type NumberValue } from './types.js'

interface Constants {
  readonly beatsPerBar: number
  readonly stepsPerBeat: number
}

export function toNumberValue (constants: Constants, literal: ast.NumberLiteral): NumberValue {
  switch (literal.unit) {
    case undefined:
    case 'bpm':
    case 'db':
    case 'hz':
    case 's':
      return NumberType.of({ unit: literal.unit, value: literal.value })
    case 'ms':
      return NumberType.of({ unit: 's', value: literal.value / 1000 })
    case 'bars':
      return NumberType.of({ unit: 'steps', value: literal.value * constants.beatsPerBar * constants.stepsPerBeat })
    case 'beats':
      return NumberType.of({ unit: 'steps', value: literal.value * constants.stepsPerBeat })
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
      return unit
    case 'ms':
      return 's'
    case 'bars':
    case 'beats':
      return 'steps'
  }
}
