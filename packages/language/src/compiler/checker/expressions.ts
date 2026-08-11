import type { SourceRange } from '@meyfa/cadence-ast'
import { ast } from '@meyfa/cadence-ast'
import type { Unit } from '@meyfa/cadence-utility'
import { setAll } from '@meyfa/cadence-utility'
import { BooleanFacet } from '../../type-system/base/boolean.ts'
import type { Capabilities, FunctionSpec } from '../../type-system/base/function.ts'
import { FunctionFacet } from '../../type-system/base/function.ts'
import { ModuleFacet } from '../../type-system/base/module.ts'
import { NumberFacet } from '../../type-system/base/number.ts'
import { RecordFacet } from '../../type-system/base/record.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import { AutomationFacet } from '../../type-system/domain/automation.ts'
import { BusFacet } from '../../type-system/domain/bus.ts'
import { CurveFacet } from '../../type-system/domain/curve.ts'
import { EffectFacet } from '../../type-system/domain/effect.ts'
import { InstrumentFacet } from '../../type-system/domain/instrument.ts'
import { MixerFacet } from '../../type-system/domain/mixer.ts'
import { ParameterFacet } from '../../type-system/domain/parameter.ts'
import { PartFacet } from '../../type-system/domain/part.ts'
import { PatternFacet } from '../../type-system/domain/pattern.ts'
import { RoutingFacet } from '../../type-system/domain/routing.ts'
import { SourceFacet } from '../../type-system/domain/source.ts'
import { TrackFacet } from '../../type-system/domain/track.ts'
import { VoiceFacet } from '../../type-system/domain/voice.ts'
import { makeUnion } from '../../type-system/factory.ts'
import type { FacetType, Type } from '../../type-system/types.ts'
import { patternBuiltins } from '../builtins/patterns.ts'
import { busSchema, instrumentSchema, mixerSchema, noteType, partSchema, stepSchema, trackSchema } from '../common.ts'
import { getCurveSegmentType } from '../curves.ts'
import { CompileError } from '../error.ts'
import { binaryOperations } from '../operators/binary.ts'
import { unaryOperations } from '../operators/unary.ts'
import { resolveInScope } from '../resolution.ts'
import { isSyntaxUnit, toBaseUnit } from '../units.ts'
import { checkArguments } from './arguments.ts'
import { createBlockChecker } from './blocks.ts'
import { mergeCapabilities, noCapabilities } from './capabilities.ts'
import { checkParameters } from './parameters.ts'
import type { Binding, Scope } from './scopes.ts'
import { createLocalScope } from './scopes.ts'
import { checkStatement } from './statements.ts'

export interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly capabilities: Capabilities
  readonly result?: TValue
}

export function checkExpression (scope: Scope, expression: ast.Expression): Checked<FacetType> {
  switch (expression.type) {
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

function expectType (expected: Pick<Type, 'is' | 'format'>, actual: Type, range?: SourceRange): readonly CompileError[] {
  if (!expected.is(actual)) {
    return [
      new CompileError(`Expected type ${expected.format()}, got ${actual.format()}`, range)
    ]
  }

  return []
}

function checkIdentifier (scope: Scope, expression: ast.Identifier): Checked<FacetType> {
  const errors: CompileError[] = []
  const capabilities = noCapabilities

  const binding = resolveInScope(scope, expression.name)
  if (binding == null) {
    errors.push(new CompileError(`Unknown identifier "${expression.name}"`, expression.range))
    return { errors, capabilities }
  }

  if (!binding.definite) {
    errors.push(new CompileError(`Identifier "${expression.name}" is not definitely assigned`, expression.range))
    return { errors, capabilities }
  }

  const result = binding.type

  return { errors, capabilities, result }
}

function checkBoolean (scope: Scope, expression: ast.Boolean): Checked<FacetType> {
  return { errors: [], capabilities: noCapabilities, result: BooleanFacet.type() }
}

function checkNumber (scope: Scope, expression: ast.Number): Checked<FacetType> {
  return { errors: [], capabilities: noCapabilities, result: NumberFacet.with(undefined).type() }
}

function checkString (scope: Scope, expression: ast.String): Checked<FacetType> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  for (const part of expression.parts) {
    if (typeof part === 'string') {
      continue
    }

    const partCheck = checkExpression(scope, part)
    errors.push(...partCheck.errors)
    capabilities = mergeCapabilities(capabilities, partCheck.capabilities)

    if (partCheck.result != null) {
      errors.push(...expectType(StringFacet.type(), partCheck.result, part.range))
    }
  }

  return { errors, capabilities, result: StringFacet.type() }
}

function checkPattern (scope: Scope, expression: ast.Pattern): Checked<FacetType> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  for (const item of expression.children) {
    if (item.type === 'Step') {
      const stepCheck = checkStep(scope, item)
      errors.push(...stepCheck.errors)
      capabilities = mergeCapabilities(capabilities, stepCheck.capabilities)
      continue
    }

    const itemCheck = checkExpression(scope, item)
    errors.push(...itemCheck.errors)
    capabilities = mergeCapabilities(capabilities, itemCheck.capabilities)

    if (itemCheck.result != null) {
      errors.push(...expectType(PatternFacet.type(), itemCheck.result, item.range))
    }
  }

  return { errors, capabilities, result: PatternFacet.type() }
}

function checkStep (scope: Scope, expression: ast.Step): Checked<void> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  if (expression.length != null) {
    const lengthCheck = checkExpression(scope, expression.length)
    errors.push(...lengthCheck.errors)
    capabilities = mergeCapabilities(capabilities, lengthCheck.capabilities)

    if (lengthCheck.result != null) {
      errors.push(...expectType(NumberFacet.with(undefined).type(), lengthCheck.result, expression.length.range))
    }
  }

  const argumentListCheck = checkArguments(scope, expression.arguments, stepSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  capabilities = mergeCapabilities(capabilities, argumentListCheck.capabilities)

  return { errors, capabilities }
}

interface CurveDetail {
  readonly unit: Unit
}

function checkCurve (scope: Scope, expression: ast.Curve): Checked<FacetType> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  if (expression.children.length === 0) {
    errors.push(new CompileError('Curve must have at least one segment', expression.range))
    return { errors, capabilities }
  }

  let detail: CurveDetail | undefined

  const append = (unit: Unit, range: SourceRange): void => {
    if (detail == null) {
      detail = { unit }
      return
    }

    if (detail.unit !== unit) {
      errors.push(new CompileError('Curve segments must have the same unit', range))
    }
  }

  for (const item of expression.children) {
    switch (item.type) {
      case 'CurveSegment': {
        const itemCheck = checkCurveSegment(scope, item, detail)
        errors.push(...itemCheck.errors)
        capabilities = mergeCapabilities(capabilities, itemCheck.capabilities)

        if (itemCheck.result == null) {
          break
        }

        append(itemCheck.result.unit, item.range)
        break
      }

      default: {
        const itemCheck = checkExpression(scope, item)
        errors.push(...itemCheck.errors)
        capabilities = mergeCapabilities(capabilities, itemCheck.capabilities)

        if (itemCheck.result == null) {
          break
        }

        if (!CurveFacet.is(itemCheck.result)) {
          errors.push(...expectType(CurveFacet.type(), itemCheck.result, item.range))
          break
        }

        append(CurveFacet.detail(itemCheck.result), item.range)
        break
      }
    }
  }

  if (errors.length > 0) {
    return { errors, capabilities }
  }

  const result = CurveFacet.with(detail?.unit).type()

  return { errors, capabilities, result }
}

const curveSegmentLengthType = makeUnion(
  NumberFacet.with('beats').type(),
  NumberFacet.with('s').type()
)

function checkCurveSegment (scope: Scope, expression: ast.CurveSegment, detail?: CurveDetail): Checked<CurveDetail> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const lengthCheck = checkExpression(scope, expression.length)
  errors.push(...lengthCheck.errors)
  capabilities = mergeCapabilities(capabilities, lengthCheck.capabilities)

  if (lengthCheck.result != null) {
    errors.push(...expectType(curveSegmentLengthType, lengthCheck.result, expression.length.range))
  }

  const expectedParameters = getCurveSegmentType(expression.curveType)?.parameterCount
  if (expectedParameters == null) {
    return { errors: [new CompileError(`Unknown curve type "${expression.curveType}"`, expression.range)], capabilities }
  }

  const actualParameters = expression.arguments.length
  const omittedFirstParameter = expectedParameters > 0 && actualParameters === expectedParameters - 1

  if (omittedFirstParameter && detail == null) {
    return { errors: [new CompileError('First curve segment cannot omit its first argument', expression.range)], capabilities }
  }

  if (!omittedFirstParameter && actualParameters !== expectedParameters) {
    const message = `Expected ${expectedParameters} ${expectedParameters === 1 ? 'argument' : 'arguments'} for ${expression.curveType} curve, got ${expression.arguments.length}`
    return { errors: [new CompileError(message, expression.range)], capabilities }
  }

  const units: Array<Unit | undefined> = []

  for (const point of expression.arguments) {
    const pointCheck = checkExpression(scope, point)
    errors.push(...pointCheck.errors)
    capabilities = mergeCapabilities(capabilities, pointCheck.capabilities)

    if (pointCheck.result != null) {
      const typeErrors = expectType(NumberFacet.type(), pointCheck.result, point.range)
      errors.push(...typeErrors)

      if (typeErrors.length === 0) {
        units.push(NumberFacet.detail(pointCheck.result))
      }
    }
  }

  if (!omittedFirstParameter && units.length === 0) {
    return { errors, capabilities }
  }

  const firstUnit = omittedFirstParameter ? detail?.unit : units[0]

  const expected = NumberFacet.with(firstUnit).type()
  for (let i = omittedFirstParameter ? 0 : 1; i < units.length; ++i) {
    errors.push(...expectType(expected, NumberFacet.with(units[i]).type(), expression.arguments[i].range))
  }

  const result = { unit: firstUnit }

  return { errors, capabilities, result }
}

function checkFunction (scope: Scope, expression: ast.Function): Checked<FacetType> {
  const errors: CompileError[] = []

  // Allow blocking calls inside the function. If a blocking call is encountered,
  // then the function itself will be marked as blocking when called.
  const functionScope = createLocalScope(scope, { mayBlock: true })

  // The act of constructing a function does not in itself require any capabilities.
  const capabilities = noCapabilities

  const parameterCheck = checkParameters(expression.parameters)
  errors.push(...parameterCheck.errors)
  if (parameterCheck.errors.length > 0) {
    // If the parameters are invalid, it makes no sense to continue checking the function body,
    // as it will produce a lot of irrelevant errors as a consequence.
    return { errors, capabilities }
  }

  const parameters = parameterCheck.schema
  const bindings = Array.from(parameterCheck.types.entries(), ([name, type]) => {
    return [name, { name, type, definite: true }] as const
  })
  setAll(functionScope.resolutions, bindings)

  let hasReturn = false
  let returnType: FacetType | undefined
  let callCapabilities = noCapabilities

  for (const child of expression.children) {
    const statement = checkStatement(functionScope, child)
    errors.push(...statement.errors)
    callCapabilities = mergeCapabilities(callCapabilities, statement.capabilities)

    for (const emission of statement.emissions) {
      if (hasReturn) {
        errors.push(new CompileError('Function has multiple return statements', emission.range))
      }

      hasReturn = true
      returnType ??= emission.type
    }

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Cannot expose properties in a function', child.range))
    }
  }

  if (!hasReturn) {
    errors.push(new CompileError('Function is missing a return statement', expression.range))
  }

  if (!hasReturn || returnType == null) {
    return { errors, capabilities }
  }

  const spec: FunctionSpec = { parameters, returnType, capabilities: callCapabilities }
  const result = FunctionFacet.with(spec).type()
  scope.top.semantic.functions.set(expression, spec)

  return { errors, capabilities, result }
}

const checkRecord = createBlockChecker<ast.RecordValue>({
  facet: RecordFacet,
  ownCapabilities: noCapabilities,
  properties: {
    allow: true
  }
})

const checkInstrument = createBlockChecker<ast.Instrument>({
  facet: InstrumentFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: instrumentSchema,

  slots: [
    {
      name: 'voice',
      type: VoiceFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

const checkVoice = createBlockChecker<ast.Voice>({
  facet: VoiceFacet,

  ownCapabilities: { mayBlock: false },
  allowedCapabilities: { mayBlock: false },

  slots: [
    {
      name: 'envelope',
      type: CurveFacet.with('db').type(),
      required: true,
      singular: true
    },
    {
      name: 'output',
      type: SourceFacet.type(),
      required: true,
      singular: true
    }
  ],

  getBindings: (expression) => {
    const bindings = new Map<string, Binding>()

    if (expression.bindings.note != null) {
      bindings.set(expression.bindings.note.name, {
        name: expression.bindings.note.name,
        type: noteType,
        definite: true,
        range: expression.bindings.note.range
      })
    }

    return bindings
  }
})

const checkMixer = createBlockChecker<ast.Mixer>({
  facet: MixerFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: mixerSchema,

  slots: [
    {
      name: 'bus',
      type: BusFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

const checkBus = createBlockChecker<ast.Bus>({
  facet: BusFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: busSchema,

  slots: [
    {
      name: 'input',
      type: makeUnion(BusFacet.type(), InstrumentFacet.type())
    },
    {
      name: 'effect',
      type: EffectFacet.type()
    }
  ],

  properties: {
    allow: true,
    initial: new Map<string, FacetType>([
      ['gain', ParameterFacet.with('db').type()],
      ['pan', ParameterFacet.with(undefined).type()]
    ])
  }
})

const checkTrack = createBlockChecker<ast.Track>({
  facet: TrackFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: trackSchema,

  slots: [
    {
      name: 'part',
      type: PartFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

const checkPart = createBlockChecker<ast.Part>({
  facet: PartFacet,

  ownCapabilities: { mayBlock: true },
  allowedCapabilities: { mayBlock: true },

  parameters: partSchema,

  slots: [
    {
      name: 'routing',
      type: RoutingFacet.type()
    },
    {
      name: 'automation',
      type: AutomationFacet.type()
    }
  ],

  properties: {
    allow: true
  }
})

function checkUnaryExpression (scope: Scope, expression: ast.UnaryExpression): Checked<FacetType> {
  const operandCheck = checkExpression(scope, expression.operand)
  const errors = [...operandCheck.errors]
  const capabilities = operandCheck.capabilities

  const operand = operandCheck.result
  if (operand == null) {
    return { errors, capabilities }
  }

  const result = unaryOperations[expression.operator].check(operand)
  if (result == null) {
    errors.push(new CompileError(`Incompatible operand for "${expression.operator}": ${operand.format()}`, expression.range))
    return { errors, capabilities }
  }

  return { errors, capabilities, result }
}

function checkBinaryExpression (scope: Scope, expression: ast.BinaryExpression): Checked<FacetType> {
  const leftCheck = checkExpression(scope, expression.left)
  const rightCheck = checkExpression(scope, expression.right)

  const errors = [...leftCheck.errors, ...rightCheck.errors]
  const capabilities = mergeCapabilities(leftCheck.capabilities, rightCheck.capabilities)

  const left = leftCheck.result
  const right = rightCheck.result

  if (left == null || right == null) {
    return { errors, capabilities }
  }

  const result = binaryOperations[expression.operator].check(left, right)
  if (result == null) {
    errors.push(new CompileError(`Incompatible operands for "${expression.operator}": ${left.format()} and ${right.format()}`, expression.range))
    return { errors, capabilities }
  }

  return { errors, capabilities, result }
}

function checkPropertyAccess (scope: Scope, expression: ast.PropertyAccess): Checked<FacetType> {
  const errors: CompileError[] = []

  const objectCheck = checkExpression(scope, expression.object)
  errors.push(...objectCheck.errors)

  const capabilities = objectCheck.capabilities

  if (objectCheck.result == null) {
    return { errors, capabilities }
  }

  const { property } = expression
  const object = objectCheck.result

  if (NumberFacet.is(object)) {
    if (!isSyntaxUnit(property.name)) {
      errors.push(new CompileError(`Unknown unit "${property.name}"`, property.range))
      return { errors, capabilities }
    }

    const existingUnit = NumberFacet.detail(object)
    if (existingUnit != null) {
      errors.push(new CompileError(`Cannot apply unit "${property.name}" to number with existing unit "${existingUnit}"`, property.range))
      return { errors, capabilities }
    }

    return { errors, capabilities, result: NumberFacet.with(toBaseUnit(property.name)).type() }
  }

  if (PatternFacet.is(object)) {
    const builtin = patternBuiltins.get(property.name)
    if (builtin != null) {
      return { errors, capabilities, result: builtin.type }
    }
  }

  if (RecordFacet.is(object)) {
    const record = RecordFacet.detail(object)
    if (Object.hasOwn(record, property.name)) {
      return { errors, capabilities, result: record[property.name] }
    }

    // Improve error messages for modules
    if (ModuleFacet.is(object)) {
      const moduleName = ModuleFacet.detail(object).name
      errors.push(new CompileError(`Module "${moduleName}" has no export named "${property.name}"`, property.range))

      return { errors, capabilities }
    }
  }

  errors.push(new CompileError(`Type ${object.format()} has no property named "${property.name}"`, property.range))

  return { errors, capabilities }
}

function checkCall (scope: Scope, expression: ast.Call): Checked<FacetType> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  const calleeCheck = checkExpression(scope, expression.callee)
  errors.push(...calleeCheck.errors)
  capabilities = mergeCapabilities(capabilities, calleeCheck.capabilities)

  if (calleeCheck.result == null) {
    return { errors, capabilities }
  }

  const callee = calleeCheck.result
  if (!FunctionFacet.is(calleeCheck.result)) {
    errors.push(new CompileError(`Cannot call value of type ${callee.format()}`, expression.range))
    return { errors, capabilities }
  }

  const {
    parameters,
    returnType,
    capabilities: functionCapabilities,
    check: checkParameters
  } = FunctionFacet.detail(callee)

  capabilities = mergeCapabilities(capabilities, functionCapabilities)

  if (!scope.allowedCapabilities.mayBlock && functionCapabilities.mayBlock) {
    const functionName = tryGetFunctionName(expression.callee)
    const message = functionName != null
      ? `Function "${functionName}" may block and cannot be called from a realtime context`
      : `Function may block and cannot be called from a realtime context`
    errors.push(new CompileError(message, expression.range))
  }

  const argumentListCheck = checkArguments(scope, expression.arguments, parameters, expression.range)
  errors.push(...argumentListCheck.errors)
  capabilities = mergeCapabilities(capabilities, argumentListCheck.capabilities)

  if (checkParameters != null) {
    const parameterErrors = checkParameters(argumentListCheck.types)
    for (const { parameter, message } of parameterErrors) {
      const range = argumentListCheck.ranges.get(parameter)
      errors.push(new CompileError(message, range))
    }
  }

  return { errors, capabilities, result: returnType }
}

function tryGetFunctionName (callee: ast.Expression): string | undefined {
  if (callee.type === 'Identifier') {
    return callee.name
  }

  if (callee.type === 'PropertyAccess') {
    return callee.property.name
  }

  return undefined
}
