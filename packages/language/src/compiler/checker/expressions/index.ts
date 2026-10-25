import { ast } from '@meyfa/cadence-ast'
import type { Type } from '../../../type-system/types.ts'
import type { Scope } from '../scopes.ts'
import { checkBus } from './blocks/bus.ts'
import { checkInstrument } from './blocks/instrument.ts'
import { checkMixer } from './blocks/mixer.ts'
import { checkPart } from './blocks/part.ts'
import { checkRecord } from './blocks/record.ts'
import { checkTrack } from './blocks/track.ts'
import { checkVoice } from './blocks/voice.ts'
import { checkBinaryExpression } from './operations/binary-expression.ts'
import { checkCall } from './operations/call.ts'
import { checkPropertyAccess } from './operations/property-access.ts'
import { checkUnaryExpression } from './operations/unary-expression.ts'
import { checkBoolean } from './primitives/boolean.ts'
import { checkCurve } from './primitives/curve.ts'
import { checkFunction } from './primitives/function.ts'
import { checkIdentifier } from './primitives/identifier.ts'
import { checkNumber } from './primitives/number.ts'
import { checkPattern } from './primitives/pattern.ts'
import { checkString } from './primitives/string.ts'
import type { Checked } from './types.ts'

export function checkExpression (scope: Scope, expression: ast.Expression): Checked<Type> {
  switch (expression.type) {
    // Primitives
    case 'Identifier':
      return checkIdentifier(scope, expression)
    case 'Boolean':
      return checkBoolean(scope, expression)
    case 'Number':
      return checkNumber(scope, expression)
    case 'String':
      return checkString(scope, expression)
    case 'Pattern':
      return checkPattern(scope, expression)
    case 'Curve':
      return checkCurve(scope, expression)
    case 'Function':
      return checkFunction(scope, expression)

    // Blocks
    case 'RecordValue':
      return checkRecord(scope, expression)
    case 'Instrument':
      return checkInstrument(scope, expression)
    case 'Voice':
      return checkVoice(scope, expression)
    case 'Mixer':
      return checkMixer(scope, expression)
    case 'Bus':
      return checkBus(scope, expression)
    case 'Track':
      return checkTrack(scope, expression)
    case 'Part':
      return checkPart(scope, expression)

    // Operations
    case 'UnaryExpression':
      return checkUnaryExpression(scope, expression)
    case 'BinaryExpression':
      return checkBinaryExpression(scope, expression)
    case 'PropertyAccess':
      return checkPropertyAccess(scope, expression)
    case 'Call':
      return checkCall(scope, expression)
  }
}
