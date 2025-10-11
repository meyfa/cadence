import type { Unit } from '../../core/program.js'
import * as ast from '../ast.js'
import { makeNumber, type NumberValue } from './values.js'

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
      return makeNumber(literal.unit, literal.value)
    case 'ms':
      return makeNumber('s', literal.value / 1000)
    case 'bars':
      return makeNumber('steps', literal.value * constants.beatsPerBar * constants.stepsPerBeat)
    case 'beats':
      return makeNumber('steps', literal.value * constants.stepsPerBeat)
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
