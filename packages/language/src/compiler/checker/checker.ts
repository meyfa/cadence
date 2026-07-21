import type { SourceRange } from '@meyfa/cadence-ast'
import { ast } from '@meyfa/cadence-ast'
import type { Brand, Unit } from '@meyfa/cadence-utility'
import { getStandardModuleNames, getStandardModuleValue } from '../../library/modules.ts'
import { CompoundError } from '../../result/errors.ts'
import type { Result } from '../../result/result.ts'
import type { Effects } from '../../type-system/base/function.ts'
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
import { makeType, makeUnion } from '../../type-system/factory.ts'
import type { Schema, SchemaItem } from '../../type-system/schema.ts'
import { makeSchema } from '../../type-system/schema.ts'
import type { FacetType, Type, Value } from '../../type-system/types.ts'
import { nonNull } from '../assert.ts'
import { globalBuiltins } from '../builtins/global.ts'
import { patternBuiltins } from '../builtins/patterns.ts'
import { BUS_NAMESPACE, busSchema, mixerSchema, noteType, partSchema, stepSchema, trackSchema } from '../common.ts'
import { getCurveSegmentType } from '../curves.ts'
import { CompileError } from '../error.ts'
import { binaryOperations } from '../operators/binary.ts'
import { unaryOperations } from '../operators/unary.ts'
import { resolveInScope } from '../resolution.ts'
import { isSyntaxUnit, toBaseUnit } from '../units.ts'
import type { MutableScope, Scope } from './scopes.ts'
import { createGlobalScope, createLocalScope, createNamespace } from './scopes.ts'

export type CheckedProgram = Brand<ast.Program, 'language.CheckedProgram'>
export type CheckResult = Result<CheckedProgram, CompoundError<CompileError>>

const success = (program: CheckedProgram): CheckResult => ({
  complete: true,
  value: program
})

const failure = (errors: readonly CompileError[]): CheckResult => ({
  complete: false,
  error: new CompoundError('Program has errors', errors)
})

export function check (program: ast.Program): CheckResult {
  const importResult = checkImports(program.imports)
  if (importResult.result == null) {
    return failure(importResult.errors)
  }

  // global builtins win over imported names
  const initialResolutions = new Map<string, FacetType>(importResult.result)
  for (const [name, value] of globalBuiltins) {
    initialResolutions.set(name, value.type)
  }

  const globalScope = createGlobalScope(initialResolutions)
  const scope = createLocalScope(globalScope)

  const errors: CompileError[] = []

  const busNamespace = createNamespace()
  scope.top.namespaces.set(BUS_NAMESPACE, busNamespace)

  let hasTrack = false
  let hasMixer = false

  for (const child of program.children) {
    const statement = checkStatement(scope, child)
    errors.push(...statement.errors)

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Cannot expose properties in the global scope', child.range))
    }

    for (const emission of statement.emissions) {
      if (MixerFacet.is(emission.type)) {
        if (hasMixer) {
          errors.push(new CompileError('Multiple mixers', emission.range))
        }
        hasMixer = true
        continue
      }

      if (TrackFacet.is(emission.type)) {
        if (hasTrack) {
          errors.push(new CompileError('Multiple tracks', emission.range))
        }
        hasTrack = true
        continue
      }

      errors.push(new CompileError(`Unexpected type ${emission.type.format()}, expected track or mixer`, emission.range))
    }
  }

  return errors.length === 0 ? success(program as CheckedProgram) : failure(errors)
}

interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly effects: Effects
  readonly result?: TValue
}

function ensureStandardModule (moduleName: string): Value<typeof ModuleFacet> {
  const module = getStandardModuleValue(moduleName)
  if (module == null) {
    throw new Error(`Missing standard library module: ${moduleName}`)
  }

  return module
}

function putAll<K, V> (map: Map<K, V>, entries: Iterable<readonly [K, V]>): void {
  for (const [key, value] of entries) {
    map.set(key, value)
  }
}

const noEffects: Effects = { blocking: false }

function mergeEffects (target: Effects, source: Effects): Effects {
  return {
    blocking: target.blocking || source.blocking
  }
}

function checkType (expected: Pick<Type, 'is' | 'format'>, actual: Type, range?: SourceRange): readonly CompileError[] {
  if (!expected.is(actual)) {
    return [
      new CompileError(`Expected type ${expected.format()}, got ${actual.format()}`, range)
    ]
  }

  return []
}

function checkImports (imports: readonly ast.Import[]): Checked<ReadonlyMap<string, FacetType>> {
  const standardLibraryModuleNames = getStandardModuleNames()

  const errors: CompileError[] = []

  const defaults = new Set<string>()
  const aliases = new Map<string, string>()

  for (const statement of imports) {
    if (!statement.library.parts.every((part) => typeof part === 'string')) {
      errors.push(new CompileError(`Imports cannot use string interpolation`, statement.library.range))
      continue
    }

    const libraryName = statement.library.parts.join('')

    if (!standardLibraryModuleNames.has(libraryName)) {
      errors.push(new CompileError(`Unknown module "${libraryName}"`, statement.range))
      continue
    }

    if (statement.alias == null) {
      if (defaults.has(libraryName)) {
        errors.push(new CompileError(`Duplicate import of "${libraryName}"`, statement.range))
      }

      defaults.add(libraryName)
      continue
    }

    if (aliases.has(statement.alias)) {
      errors.push(new CompileError(`Duplicate import alias "${statement.alias}"`, statement.range))
      continue
    }

    aliases.set(statement.alias, libraryName)
  }

  if (errors.length > 0) {
    return { errors, effects: noEffects }
  }

  const result = new Map<string, FacetType>()

  // defaults must come before aliases to allow aliasing over default imports
  for (const importName of defaults) {
    const module = ensureStandardModule(importName)
    for (const [name, value] of ModuleFacet.get(module).exports.entries()) {
      result.set(name, value.type)
    }
  }

  for (const [alias, importName] of aliases) {
    const module = ensureStandardModule(importName)
    result.set(alias, module.type)
  }

  return { errors, effects: noEffects, result }
}

interface CheckedStatement {
  readonly errors: readonly CompileError[]
  readonly effects: Effects
  readonly emissions: readonly Emission[]
  readonly properties: ReadonlyMap<string, FacetType>
}

interface Emission {
  readonly type: FacetType
  readonly range: SourceRange
}

function checkStatement (scope: MutableScope, statement: ast.Statement, existingProperties?: ReadonlyMap<string, FacetType>): CheckedStatement {
  const errors: CompileError[] = []
  let effects = noEffects
  const emissions: Emission[] = []
  const properties = new Map<string, FacetType>()

  const values: Array<FacetType | undefined> = []

  for (const value of statement.values) {
    const valueCheck = checkExpression(scope, value)
    errors.push(...valueCheck.errors)
    values.push(valueCheck.result)
    effects = mergeEffects(effects, valueCheck.effects)
  }

  if (statement.emit) {
    for (let i = 0; i < values.length; ++i) {
      const { range } = statement.values[i]

      const type = values[i]
      if (type == null) {
        continue
      }

      emissions.push({ type, range })
    }
  }

  if (statement.name != null) {
    const duplicate = scope.resolutions.has(statement.name.name)
    if (duplicate) {
      errors.push(new CompileError(`Identifier "${statement.name.name}" is already defined`, statement.name.range))
    }

    const type = values.at(0)
    if (type != null && !duplicate) {
      scope.resolutions.set(statement.name.name, type)
    }
  }

  if (statement.expose) {
    const propertyName = statement.name.name
    const propertyValue = values.at(0)

    if (existingProperties?.has(propertyName) === true) {
      errors.push(new CompileError(`Duplicate property "${propertyName}"`, statement.name.range))
    } else if (propertyValue != null) {
      properties.set(propertyName, values.at(0) ?? StringFacet.type())
    }
  }

  return { errors, effects, emissions, properties }
}

function checkExpression (scope: Scope, expression: ast.Expression): Checked<FacetType> {
  switch (expression.type) {
    case 'Identifier':
      return checkIdentifier(scope, expression)

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

function checkIdentifier (scope: Scope, expression: ast.Identifier): Checked<FacetType> {
  const valueType = resolveInScope(scope, expression.name)
  if (valueType == null) {
    return { errors: [new CompileError(`Unknown identifier "${expression.name}"`, expression.range)], effects: noEffects }
  }

  return { errors: [], effects: noEffects, result: valueType }
}

function checkNumber (scope: Scope, expression: ast.Number): Checked<FacetType> {
  return { errors: [], effects: noEffects, result: NumberFacet.with(undefined).type() }
}

function checkString (scope: Scope, expression: ast.String): Checked<FacetType> {
  const errors: CompileError[] = []
  let effects = noEffects

  for (const part of expression.parts) {
    if (typeof part === 'string') {
      continue
    }

    const partCheck = checkExpression(scope, part)
    errors.push(...partCheck.errors)
    effects = mergeEffects(effects, partCheck.effects)

    if (partCheck.result != null) {
      errors.push(...checkType(StringFacet.type(), partCheck.result, part.range))
    }
  }

  return { errors, effects, result: StringFacet.type() }
}

function checkPattern (scope: Scope, expression: ast.Pattern): Checked<FacetType> {
  const errors: CompileError[] = []
  let effects = noEffects

  for (const item of expression.children) {
    if (item.type === 'Step') {
      const stepCheck = checkStep(scope, item)
      errors.push(...stepCheck.errors)
      effects = mergeEffects(effects, stepCheck.effects)
      continue
    }

    const itemCheck = checkExpression(scope, item)
    errors.push(...itemCheck.errors)
    effects = mergeEffects(effects, itemCheck.effects)

    if (itemCheck.result != null) {
      errors.push(...checkType(PatternFacet.type(), itemCheck.result, item.range))
    }
  }

  return { errors, effects, result: PatternFacet.type() }
}

function checkStep (scope: Scope, expression: ast.Step): Checked<void> {
  const errors: CompileError[] = []
  let effects = noEffects

  if (expression.length != null) {
    const lengthCheck = checkExpression(scope, expression.length)
    errors.push(...lengthCheck.errors)
    effects = mergeEffects(effects, lengthCheck.effects)

    if (lengthCheck.result != null) {
      errors.push(...checkType(NumberFacet.with(undefined).type(), lengthCheck.result, expression.length.range))
    }
  }

  const argumentListCheck = checkArgumentList(scope, expression.arguments, stepSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  effects = mergeEffects(effects, argumentListCheck.effects)

  return { errors, effects }
}

function checkCurve (scope: Scope, expression: ast.Curve): Checked<FacetType> {
  const errors: CompileError[] = []
  let effects = noEffects

  const segments = expression.children.filter((c): c is ast.CurveSegment => c.type === 'CurveSegment')
  const otherChildren = expression.children.filter((c) => c.type !== 'CurveSegment')

  for (const child of otherChildren) {
    // TODO Add support for interpolation in curves
    errors.push(new CompileError('Curve interpolation is not supported yet', child.range))
  }

  if (segments.length === 0) {
    errors.push(new CompileError('Curve must have at least one segment', expression.range))
    return { errors, effects }
  }

  const segmentChecks: Array<Checked<Unit>> = []
  let previousUnit: Unit | undefined

  for (let i = 0; i < segments.length; ++i) {
    const segmentCheck = checkCurveSegment(scope, segments[i], i > 0, previousUnit)
    segmentChecks.push(segmentCheck)
    errors.push(...segmentCheck.errors)
    effects = mergeEffects(effects, segmentCheck.effects)

    if (segmentCheck.result != null) {
      previousUnit = segmentCheck.result
    }
  }

  if (errors.length > 0) {
    return { errors, effects }
  }

  const firstUnit = segmentChecks[0].result

  for (let i = 1; i < segmentChecks.length; ++i) {
    if (segmentChecks[i].result !== firstUnit) {
      errors.push(new CompileError('Curve segments must have the same unit', segments[i].range))
    }
  }

  const result = CurveFacet.with(firstUnit).type()

  return { errors, effects, result }
}

const curveSegmentLengthType = makeUnion(
  NumberFacet.with('beats').type(),
  NumberFacet.with('s').type()
)

function checkCurveSegment (scope: Scope, expression: ast.CurveSegment, hasPrevious: boolean, previousUnit: Unit | undefined): Checked<Unit> {
  const errors: CompileError[] = []
  let effects = noEffects

  const lengthCheck = checkExpression(scope, expression.length)
  errors.push(...lengthCheck.errors)
  effects = mergeEffects(effects, lengthCheck.effects)

  if (lengthCheck.result != null) {
    errors.push(...checkType(curveSegmentLengthType, lengthCheck.result, expression.length.range))
  }

  const expectedParameters = getCurveSegmentType(expression.curveType)?.parameterCount
  if (expectedParameters == null) {
    return { errors: [new CompileError(`Unknown curve type "${expression.curveType}"`, expression.range)], effects }
  }

  const actualParameters = expression.arguments.length
  const omittedFirstParameter = expectedParameters > 0 && actualParameters === expectedParameters - 1

  if (omittedFirstParameter && !hasPrevious) {
    return { errors: [new CompileError('First curve segment cannot omit its first argument', expression.range)], effects }
  }

  if (!omittedFirstParameter && actualParameters !== expectedParameters) {
    const message = `Expected ${expectedParameters} ${expectedParameters === 1 ? 'argument' : 'arguments'} for ${expression.curveType} curve, got ${expression.arguments.length}`
    return { errors: [new CompileError(message, expression.range)], effects }
  }

  const units: Array<Unit | undefined> = []

  for (const point of expression.arguments) {
    const pointCheck = checkExpression(scope, point)
    errors.push(...pointCheck.errors)
    effects = mergeEffects(effects, pointCheck.effects)

    if (pointCheck.result != null) {
      const typeErrors = checkType(NumberFacet.type(), pointCheck.result, point.range)
      errors.push(...typeErrors)

      if (typeErrors.length === 0) {
        units.push(NumberFacet.detail(pointCheck.result))
      }
    }
  }

  if (!omittedFirstParameter && units.length === 0) {
    return { errors, effects }
  }

  const firstUnit = omittedFirstParameter ? previousUnit : units[0]

  const expected = NumberFacet.with(firstUnit).type()
  for (let i = omittedFirstParameter ? 0 : 1; i < units.length; ++i) {
    errors.push(...checkType(expected, NumberFacet.with(units[i]).type(), expression.arguments[i].range))
  }

  return { errors, effects, result: firstUnit }
}

function checkFunction (scope: Scope, expression: ast.Function): Checked<FacetType> {
  const errors: CompileError[] = []

  // Allow blocking calls inside the function. If a blocking call is encountered,
  // then the function itself will be marked as blocking.
  const functionScope = createLocalScope(scope, { blocking: true })

  // TODO Support parameters
  if (expression.parameters.length > 0) {
    errors.push(new CompileError('Function parameters are not supported yet', expression.range))
  }

  let hasReturn = false
  let returnType: FacetType | undefined
  let blocking = false

  for (const child of expression.children) {
    const statement = checkStatement(functionScope, child)
    errors.push(...statement.errors)

    blocking ||= statement.effects.blocking

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
    return { errors, effects: noEffects }
  }

  const result = FunctionFacet.with({
    parameters: makeSchema([]),
    returnType,
    effects: { blocking }
  }).type()

  return { errors, effects: noEffects, result }
}

function checkInstrument (scope: Scope, expression: ast.Instrument): Checked<FacetType> {
  const errors: CompileError[] = []
  let effects: Effects = { blocking: true }

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct an instrument in a realtime context', expression.range))
  }

  const instrumentScope = createLocalScope(scope)
  const properties = new Map<string, FacetType>()

  for (const child of expression.children) {
    const statement = checkStatement(instrumentScope, child, properties)
    errors.push(...statement.errors)
    effects = mergeEffects(effects, statement.effects)

    for (const emission of statement.emissions) {
      errors.push(...checkType(VoiceFacet.type(), emission.type, emission.range))
    }

    putAll(properties, statement.properties)
  }

  const result = properties.size > 0
    ? makeType(InstrumentFacet, RecordFacet.with(Object.fromEntries(properties)))
    : InstrumentFacet.type()

  return { errors, effects, result }
}

function checkVoice (scope: Scope, expression: ast.Voice): Checked<FacetType> {
  const voiceScope = createLocalScope(scope, { blocking: false })
  const errors: CompileError[] = []

  if (expression.bindings.note != null) {
    voiceScope.resolutions.set(expression.bindings.note.name, noteType)
  }

  const properties = new Map<string, FacetType>()
  let hasEnvelope = false
  let hasOutput = false

  for (const child of expression.children) {
    const statement = checkStatement(voiceScope, child, properties)
    errors.push(...statement.errors)

    for (const emission of statement.emissions) {
      if (CurveFacet.with('db').is(emission.type)) {
        if (hasEnvelope) {
          errors.push(new CompileError('Multiple envelopes in a voice', emission.range))
        }
        hasEnvelope = true
        continue
      }

      if (SourceFacet.is(emission.type)) {
        if (hasOutput) {
          errors.push(new CompileError('Multiple outputs in a voice', emission.range))
        }
        hasOutput = true
        continue
      }

      errors.push(new CompileError(`Unexpected type ${emission.type.format()}, expected envelope or output`, emission.range))
    }

    putAll(properties, statement.properties)
  }

  if (!hasEnvelope) {
    errors.push(new CompileError('Voice is missing an envelope', expression.range))
  }

  if (!hasOutput) {
    errors.push(new CompileError('Voice is missing an output', expression.range))
  }

  // Properties cannot be used to extend the voice as the voice is generated at runtime.
  const result = VoiceFacet.type()

  return { errors, effects: noEffects, result }
}

function checkMixer (scope: Scope, expression: ast.Mixer): Checked<FacetType> {
  const mixerScope = createLocalScope(scope)
  const errors: CompileError[] = []
  let effects: Effects = { blocking: true }

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct a mixer in a realtime context', expression.range))
  }

  const argumentListCheck = checkArgumentList(mixerScope, expression.arguments, mixerSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  effects = mergeEffects(effects, argumentListCheck.effects)

  const properties = new Map<string, FacetType>()

  for (const child of expression.children) {
    const statement = checkStatement(mixerScope, child, properties)
    errors.push(...statement.errors)
    effects = mergeEffects(effects, statement.effects)

    for (const emission of statement.emissions) {
      errors.push(...checkType(BusFacet.type(), emission.type, emission.range))
    }

    putAll(properties, statement.properties)
  }

  const result = properties.size > 0
    ? makeType(MixerFacet, RecordFacet.with(Object.fromEntries(properties)))
    : MixerFacet.type()

  return { errors, effects, result }
}

const busEmissionType = makeUnion(InstrumentFacet.type(), BusFacet.type(), EffectFacet.type())

function checkBus (scope: Scope, expression: ast.Bus): Checked<FacetType> {
  const busScope = createLocalScope(scope)
  const errors: CompileError[] = []
  let effects: Effects = { blocking: true }

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct a bus in a realtime context', expression.range))
  }

  const argumentListCheck = checkArgumentList(busScope, expression.arguments, busSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  effects = mergeEffects(effects, argumentListCheck.effects)

  const properties = new Map<string, FacetType>()
  properties.set('gain', ParameterFacet.with('db').type())
  properties.set('pan', ParameterFacet.with(undefined).type())

  for (const child of expression.children) {
    const statement = checkStatement(busScope, child, properties)
    errors.push(...statement.errors)
    effects = mergeEffects(effects, statement.effects)

    for (const emission of statement.emissions) {
      errors.push(...checkType(busEmissionType, emission.type, emission.range))
    }

    putAll(properties, statement.properties)
  }

  const result = makeType(BusFacet, RecordFacet.with(Object.fromEntries(properties)))

  if (expression.name != null) {
    const namespace = nonNull(scope.top.namespaces.get(BUS_NAMESPACE))
    if (namespace.resolutions.has(expression.name.name)) {
      errors.push(new CompileError(`Duplicate bus named "${expression.name.name}"`, expression.range))
    } else {
      namespace.resolutions.set(expression.name.name, result)
    }
  }

  return { errors, effects, result }
}

function checkTrack (scope: Scope, expression: ast.Track): Checked<FacetType> {
  const trackScope = createLocalScope(scope)
  const errors: CompileError[] = []
  let effects: Effects = { blocking: true }

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct a track in a realtime context', expression.range))
  }

  const argumentListCheck = checkArgumentList(trackScope, expression.arguments, trackSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  effects = mergeEffects(effects, argumentListCheck.effects)

  const properties = new Map<string, FacetType>()

  for (const child of expression.children) {
    const statement = checkStatement(trackScope, child, properties)
    errors.push(...statement.errors)
    effects = mergeEffects(effects, statement.effects)

    for (const emission of statement.emissions) {
      errors.push(...checkType(PartFacet.type(), emission.type, emission.range))
    }

    putAll(properties, statement.properties)
  }

  const result = properties.size > 0
    ? makeType(TrackFacet, RecordFacet.with(Object.fromEntries(properties)))
    : TrackFacet.type()

  return { errors, effects, result }
}

const partEmissionType = makeUnion(RoutingFacet.type(), AutomationFacet.type())

function checkPart (scope: Scope, expression: ast.Part): Checked<FacetType> {
  const partScope = createLocalScope(scope)
  const errors: CompileError[] = []
  let effects: Effects = { blocking: true }

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct a part in a realtime context', expression.range))
  }

  const argumentListCheck = checkArgumentList(partScope, expression.arguments, partSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  effects = mergeEffects(effects, argumentListCheck.effects)

  const properties = new Map<string, FacetType>()

  for (const child of expression.children) {
    const statement = checkStatement(partScope, child, properties)
    errors.push(...statement.errors)
    effects = mergeEffects(effects, statement.effects)

    for (const emission of statement.emissions) {
      errors.push(...checkType(partEmissionType, emission.type, emission.range))
    }

    putAll(properties, statement.properties)
  }

  const result = properties.size > 0
    ? makeType(PartFacet, RecordFacet.with(Object.fromEntries(properties)))
    : PartFacet.type()

  return { errors, effects, result }
}

function checkUnaryExpression (scope: Scope, expression: ast.UnaryExpression): Checked<FacetType> {
  const operandCheck = checkExpression(scope, expression.operand)
  const errors = [...operandCheck.errors]
  const effects = operandCheck.effects

  const operand = operandCheck.result
  if (operand == null) {
    return { errors, effects }
  }

  const result = unaryOperations[expression.operator].check(operand)
  if (result == null) {
    errors.push(new CompileError(`Incompatible operand for "${expression.operator}": ${operand.format()}`, expression.range))
    return { errors, effects }
  }

  return { errors, effects, result }
}

function checkBinaryExpression (scope: Scope, expression: ast.BinaryExpression): Checked<FacetType> {
  const leftCheck = checkExpression(scope, expression.left)
  const rightCheck = checkExpression(scope, expression.right)

  const errors = [...leftCheck.errors, ...rightCheck.errors]
  const effects = mergeEffects(leftCheck.effects, rightCheck.effects)

  const left = leftCheck.result
  const right = rightCheck.result

  if (left == null || right == null) {
    return { errors, effects }
  }

  const result = binaryOperations[expression.operator].check(left, right)
  if (result == null) {
    errors.push(new CompileError(`Incompatible operands for "${expression.operator}": ${left.format()} and ${right.format()}`, expression.range))
    return { errors, effects }
  }

  return { errors, effects, result }
}

function checkPropertyAccess (scope: Scope, expression: ast.PropertyAccess): Checked<FacetType> {
  const errors: CompileError[] = []

  if (expression.object.type === 'Identifier') {
    const namespace = scope.top.namespaces.get(expression.object.name)
    if (namespace != null) {
      const propertyType = namespace.resolutions.get(expression.property.name)
      if (propertyType == null) {
        errors.push(new CompileError(`Namespace "${expression.object.name}" has no member named "${expression.property.name}"`, expression.property.range))
        return { errors, effects: noEffects }
      }

      return { errors, effects: noEffects, result: propertyType }
    }
  }

  const objectCheck = checkExpression(scope, expression.object)
  errors.push(...objectCheck.errors)

  const effects = objectCheck.effects

  if (objectCheck.result == null) {
    return { errors, effects }
  }

  const { property } = expression
  const object = objectCheck.result

  if (NumberFacet.is(object)) {
    if (!isSyntaxUnit(property.name)) {
      errors.push(new CompileError(`Unknown unit "${property.name}"`, property.range))
      return { errors, effects }
    }

    const existingUnit = NumberFacet.detail(object)
    if (existingUnit != null) {
      errors.push(new CompileError(`Cannot apply unit "${property.name}" to number with existing unit "${existingUnit}"`, property.range))
      return { errors, effects }
    }

    return { errors, effects, result: NumberFacet.with(toBaseUnit(property.name)).type() }
  }

  if (PatternFacet.is(object)) {
    const builtin = patternBuiltins.get(property.name)
    if (builtin != null) {
      return { errors, effects, result: builtin.type }
    }
  }

  if (RecordFacet.is(object)) {
    const record = RecordFacet.detail(object)
    if (Object.hasOwn(record, property.name)) {
      return { errors, effects, result: record[property.name] }
    }

    // Improve error messages for modules
    if (ModuleFacet.is(object)) {
      const moduleName = ModuleFacet.detail(object).name
      errors.push(new CompileError(`Module "${moduleName}" has no export named "${property.name}"`, property.range))

      return { errors, effects }
    }
  }

  errors.push(new CompileError(`Type ${object.format()} has no property named "${property.name}"`, property.range))

  return { errors, effects }
}

function checkCall (scope: Scope, expression: ast.Call): Checked<FacetType> {
  const errors: CompileError[] = []
  let effects = noEffects

  const calleeCheck = checkExpression(scope, expression.callee)
  errors.push(...calleeCheck.errors)
  effects = mergeEffects(effects, calleeCheck.effects)

  if (calleeCheck.result == null) {
    return { errors, effects }
  }

  const callee = calleeCheck.result
  if (!FunctionFacet.is(calleeCheck.result)) {
    errors.push(new CompileError(`Cannot call value of type ${callee.format()}`, expression.range))
    return { errors, effects }
  }

  const { parameters, returnType, effects: functionEffects, check: checkParameters } = FunctionFacet.detail(callee)
  effects = mergeEffects(effects, functionEffects)

  if (!scope.allowedEffects.blocking && functionEffects.blocking) {
    const functionName = tryGetFunctionName(expression.callee)
    const message = functionName != null
      ? `Function "${functionName}" may block and cannot be called from a realtime context`
      : `Function may block and cannot be called from a realtime context`
    errors.push(new CompileError(message, expression.range))
  }

  const argumentListCheck = checkArgumentList(scope, expression.arguments, parameters, expression.range)
  errors.push(...argumentListCheck.errors)
  effects = mergeEffects(effects, argumentListCheck.effects)

  if (checkParameters != null) {
    const parameterErrors = checkParameters(argumentListCheck.types)
    for (const { parameter, message } of parameterErrors) {
      const range = argumentListCheck.ranges.get(parameter)
      errors.push(new CompileError(message, range))
    }
  }

  return { errors, effects, result: returnType }
}

interface ArgumentListCheckResult {
  readonly errors: readonly CompileError[]
  readonly effects: Effects
  readonly types: ReadonlyMap<string, FacetType>
  readonly ranges: ReadonlyMap<string, SourceRange>
}

function checkArgumentList (
  scope: Scope,
  args: readonly ast.Argument[],
  schema: Schema,
  range: SourceRange
): ArgumentListCheckResult {
  const errors: CompileError[] = []
  let effects = noEffects
  const types = new Map<string, FacetType>()
  const ranges = new Map<string, SourceRange>()

  const seen = new Set<string>()
  let namedStarted = false

  for (let index = 0; index < args.length; ++index) {
    const arg = args[index]

    let spec: SchemaItem | undefined

    if (arg.name != null || namedStarted) {
      namedStarted = true

      if (arg.name == null) {
        errors.push(new CompileError(`Unexpected positional argument after named arguments`, arg.range))
        continue
      }

      spec = schema.byName.get(arg.name.name)
      if (spec == null) {
        errors.push(new CompileError(`Unknown argument "${arg.name.name}"`, arg.name.range))
        continue
      }

      if (seen.has(spec.name)) {
        errors.push(new CompileError(`Duplicate argument named "${arg.name.name}"`, arg.name.range))
        continue
      }
    } else {
      spec = schema.items.at(index)
      if (spec == null) {
        errors.push(new CompileError(`Unknown positional argument`, arg.range))
        continue
      }
    }

    seen.add(spec.name)

    const expressionCheck = checkExpression(scope, arg.value)
    errors.push(...expressionCheck.errors)
    effects = mergeEffects(effects, expressionCheck.effects)

    if (expressionCheck.result != null) {
      if (!spec.type.is(expressionCheck.result)) {
        errors.push(new CompileError(`Expected type ${spec.type.format()} for argument "${spec.name}", got ${expressionCheck.result.format()}`, arg.value.range))
      } else {
        types.set(spec.name, expressionCheck.result)
        ranges.set(spec.name, arg.value.range)
      }
    }
  }

  for (const spec of schema.items) {
    if (spec.required && !seen.has(spec.name)) {
      errors.push(new CompileError(`Missing required argument "${spec.name}"`, range))
    }
  }

  return { errors, effects, types, ranges }
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
