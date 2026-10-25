import { ast } from '@meyfa/cadence-ast'
import type { Value } from '../../../type-system/types.ts'
import type { Scope } from '../scopes.ts'
import { generateBus } from './blocks/bus.ts'
import { generateInstrument } from './blocks/instrument.ts'
import { generateMixer } from './blocks/mixer.ts'
import { generatePart } from './blocks/part.ts'
import { generateRecord } from './blocks/record.ts'
import { generateTrack } from './blocks/track.ts'
import { generateVoice } from './blocks/voice.ts'
import { generateBinaryExpression } from './operations/binary-expression.ts'
import { generateCall } from './operations/call.ts'
import { generatePropertyAccess } from './operations/property-access.ts'
import { generateUnaryExpression } from './operations/unary-expression.ts'
import { generateBoolean } from './primitives/boolean.ts'
import { generateCurve } from './primitives/curve.ts'
import { generateFunction } from './primitives/function.ts'
import { generateIdentifier } from './primitives/identifier.ts'
import { generateNumber } from './primitives/number.ts'
import { generatePattern } from './primitives/pattern.ts'
import { generateString } from './primitives/string.ts'

/**
 * Resolve an expression to a value within the given scope. Since this expression (or sub-expressions) may call
 * functions, the scope may be updated.
 */
export function resolve (scope: Scope, expression: ast.Expression): Value {
  switch (expression.type) {
    // Primitives
    case 'Identifier':
      return generateIdentifier(scope, expression)
    case 'Boolean':
      return generateBoolean(scope, expression)
    case 'Number':
      return generateNumber(scope, expression)
    case 'String':
      return generateString(scope, expression)
    case 'Pattern':
      return generatePattern(scope, expression)
    case 'Curve':
      return generateCurve(scope, expression)
    case 'Function':
      return generateFunction(scope, expression)

    // Blocks
    case 'RecordValue':
      return generateRecord(scope, expression)
    case 'Instrument':
      return generateInstrument(scope, expression)
    case 'Voice':
      return generateVoice(scope, expression)
    case 'Mixer':
      return generateMixer(scope, expression)
    case 'Bus':
      return generateBus(scope, expression)
    case 'Track':
      return generateTrack(scope, expression)
    case 'Part':
      return generatePart(scope, expression)

    // Operations
    case 'UnaryExpression':
      return generateUnaryExpression(scope, expression)
    case 'BinaryExpression':
      return generateBinaryExpression(scope, expression)
    case 'PropertyAccess':
      return generatePropertyAccess(scope, expression)
    case 'Call':
      return generateCall(scope, expression)
  }
}
