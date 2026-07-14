import type { SourceRange } from '@meyfa/cadence-ast'
import { ast } from '@meyfa/cadence-ast'
import type { Brand, Unit } from '@meyfa/cadence-utility'
import { getStandardModuleNames, getStandardModuleValue } from '../../library/modules.ts'
import { CompoundError } from '../../result/errors.ts'
import type { Result } from '../../result/result.ts'
import { FunctionFacet } from '../../type-system/base/function.ts'
import { ModuleFacet } from '../../type-system/base/module.ts'
import { NumberFacet } from '../../type-system/base/number.ts'
import { RecordFacet } from '../../type-system/base/record.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import { BusFacet } from '../../type-system/domain/bus.ts'
import { CurveFacet } from '../../type-system/domain/curve.ts'
import { EffectFacet } from '../../type-system/domain/effect.ts'
import { InstrumentFacet } from '../../type-system/domain/instrument.ts'
import { MixerFacet } from '../../type-system/domain/mixer.ts'
import { ParameterFacet } from '../../type-system/domain/parameter.ts'
import { PartFacet } from '../../type-system/domain/part.ts'
import { PatternFacet } from '../../type-system/domain/pattern.ts'
import { SourceFacet } from '../../type-system/domain/source.ts'
import { TrackFacet } from '../../type-system/domain/track.ts'
import { VoiceFacet } from '../../type-system/domain/voice.ts'
import { makeType, makeUnion } from '../../type-system/factory.ts'
import type { Schema, SchemaItem } from '../../type-system/schema.ts'
import type { FacetType, Type, Value } from '../../type-system/types.ts'
import { assertNever, nonNull } from '../assert.ts'
import { patternBuiltins } from '../builtins/patterns.ts'
import { BUS_NAMESPACE, busSchema, mixerSchema, noteType, partSchema, stepSchema, trackSchema } from '../common.ts'
import { getCurveSegmentType } from '../curves.ts'
import { CompileError } from '../error.ts'
import { binaryOperations } from '../operators/binary.ts'
import { unaryOperations } from '../operators/unary.ts'
import { resolveInScope } from '../resolution.ts'
import { isSyntaxUnit, toBaseUnit } from '../units.ts'
import { checkCyclicRoutings } from './routings.ts'
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

  const globalScope = createGlobalScope(importResult.result)
  const scope = createLocalScope(globalScope)

  const errors: CompileError[] = []

  const busNamespace = createNamespace()
  scope.top.namespaces.set(BUS_NAMESPACE, busNamespace)

  let hasTrack = false
  let hasMixer = false

  for (const child of program.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(scope, child))
        break

      case 'Track': {
        if (hasTrack) {
          errors.push(new CompileError('Multiple track definitions', child.range))
        }
        hasTrack = true
        const trackCheck = checkExpression(scope, child)
        errors.push(...trackCheck.errors)
        break
      }

      case 'Mixer': {
        if (hasMixer) {
          errors.push(new CompileError('Multiple mixer definitions', child.range))
        }
        hasMixer = true
        const mixerCheck = checkExpression(scope, child)
        errors.push(...mixerCheck.errors)
        break
      }

      default:
        assertNever(child)
    }
  }

  return errors.length === 0 ? success(program as CheckedProgram) : failure(errors)
}

interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly result?: TValue
}

function ensureStandardModule (moduleName: string): Value<typeof ModuleFacet> {
  const module = getStandardModuleValue(moduleName)
  if (module == null) {
    throw new Error(`Missing standard library module: ${moduleName}`)
  }

  return module
}

function checkType (expected: Pick<Type, 'is' | 'format'>, actual: Type, range?: SourceRange): readonly CompileError[] {
  if (!expected.is(actual)) {
    return [
      new CompileError(`Expected type ${expected.format()}, got ${actual.format()}`, range)
    ]
  }

  return []
}

function checkImports (imports: readonly ast.UseStatement[]): Checked<ReadonlyMap<string, FacetType>> {
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
    return { errors }
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

  return { errors, result }
}

function checkAssignment (scope: MutableScope, assignment: ast.Assignment): readonly CompileError[] {
  const errors: CompileError[] = []

  const duplicate = scope.resolutions.has(assignment.key.name)
  if (duplicate) {
    errors.push(new CompileError(`Identifier "${assignment.key.name}" is already defined`, assignment.key.range))
  }

  const expressionCheck = checkExpression(scope, assignment.value)
  errors.push(...expressionCheck.errors)

  if (!duplicate && expressionCheck.result != null) {
    scope.resolutions.set(assignment.key.name, expressionCheck.result)
  }

  return errors
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

    case 'Instrument':
      return checkInstrument(scope, expression)

    case 'Voice':
      return checkVoice(scope, expression)

    case 'Mixer':
      return checkMixer(scope, expression)

    case 'Track':
      return checkTrack(scope, expression)

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

function checkIdentifier (scope: Scope, identifier: ast.Identifier): Checked<FacetType> {
  const valueType = resolveInScope(scope, identifier.name)
  if (valueType == null) {
    return { errors: [new CompileError(`Unknown identifier "${identifier.name}"`, identifier.range)] }
  }

  return { errors: [], result: valueType }
}

function checkNumber (scope: Scope, number: ast.Number): Checked<FacetType> {
  return { errors: [], result: NumberFacet.with(undefined).type() }
}

function checkString (scope: Scope, string: ast.String): Checked<FacetType> {
  const errors: CompileError[] = []

  for (const part of string.parts) {
    if (typeof part === 'string') {
      continue
    }

    const partCheck = checkExpression(scope, part)
    errors.push(...partCheck.errors)

    if (partCheck.result != null) {
      errors.push(...checkType(StringFacet.type(), partCheck.result, part.range))
    }
  }

  return { errors, result: StringFacet.type() }
}

function checkPattern (scope: Scope, pattern: ast.Pattern): Checked<FacetType> {
  const errors: CompileError[] = []

  for (const item of pattern.children) {
    if (item.type === 'Step') {
      errors.push(...checkStep(scope, item))
      continue
    }

    const itemCheck = checkExpression(scope, item)
    errors.push(...itemCheck.errors)

    if (itemCheck.result != null) {
      errors.push(...checkType(PatternFacet.type(), itemCheck.result, item.range))
    }
  }

  return { errors, result: PatternFacet.type() }
}

function checkStep (scope: Scope, step: ast.Step): readonly CompileError[] {
  const errors: CompileError[] = []

  if (step.length != null) {
    const lengthCheck = checkExpression(scope, step.length)
    errors.push(...lengthCheck.errors)

    if (lengthCheck.result != null) {
      errors.push(...checkType(NumberFacet.with(undefined).type(), lengthCheck.result, step.length.range))
    }
  }

  errors.push(...checkArgumentList(scope, step.parameters, stepSchema, step.range))

  return errors
}

function checkCurve (scope: Scope, curve: ast.Curve): Checked<FacetType> {
  const errors: CompileError[] = []

  const segments = curve.children.filter((c): c is ast.CurveSegment => c.type === 'CurveSegment')
  const otherChildren = curve.children.filter((c) => c.type !== 'CurveSegment')

  for (const child of otherChildren) {
    // TODO Add support for interpolation in curves
    errors.push(new CompileError('Curve interpolation is not supported yet', child.range))
  }

  if (segments.length === 0) {
    errors.push(new CompileError('Curve must have at least one segment', curve.range))
    return { errors }
  }

  const segmentChecks: Array<Checked<Unit>> = []
  let previousUnit: Unit | undefined

  for (let i = 0; i < segments.length; ++i) {
    const segmentCheck = checkCurveSegment(scope, segments[i], i > 0, previousUnit)
    segmentChecks.push(segmentCheck)
    errors.push(...segmentCheck.errors)

    if (segmentCheck.result != null) {
      previousUnit = segmentCheck.result
    }
  }

  if (errors.length > 0) {
    return { errors }
  }

  const firstUnit = segmentChecks[0].result

  for (let i = 1; i < segmentChecks.length; ++i) {
    if (segmentChecks[i].result !== firstUnit) {
      errors.push(new CompileError('Curve segments must have the same unit', segments[i].range))
    }
  }

  return { errors, result: CurveFacet.with(firstUnit).type() }
}

const curveSegmentLengthType = makeUnion(
  NumberFacet.with('beats').type(),
  NumberFacet.with('s').type()
)

function checkCurveSegment (scope: Scope, segment: ast.CurveSegment, hasPrevious: boolean, previousUnit: Unit | undefined): Checked<Unit> {
  const errors: CompileError[] = []

  const lengthCheck = checkExpression(scope, segment.length)
  errors.push(...lengthCheck.errors)

  if (lengthCheck.result != null) {
    errors.push(...checkType(curveSegmentLengthType, lengthCheck.result, segment.length.range))
  }

  const expectedParameters = getCurveSegmentType(segment.curveType)?.parameterCount
  if (expectedParameters == null) {
    return { errors: [new CompileError(`Unknown curve type "${segment.curveType}"`, segment.range)] }
  }

  const actualParameters = segment.parameters.length
  const omittedFirstParameter = expectedParameters > 0 && actualParameters === expectedParameters - 1

  if (omittedFirstParameter && !hasPrevious) {
    return { errors: [new CompileError('First curve segment cannot omit its first parameter', segment.range)] }
  }

  if (!omittedFirstParameter && actualParameters !== expectedParameters) {
    const message = `Expected ${expectedParameters} ${expectedParameters === 1 ? 'parameter' : 'parameters'} for ${segment.curveType} curve, got ${segment.parameters.length}`
    return { errors: [new CompileError(message, segment.range)] }
  }

  const units: Array<Unit | undefined> = []

  for (const point of segment.parameters) {
    const pointCheck = checkExpression(scope, point)
    errors.push(...pointCheck.errors)

    if (pointCheck.result != null) {
      const typeErrors = checkType(NumberFacet.type(), pointCheck.result, point.range)
      errors.push(...typeErrors)

      if (typeErrors.length === 0) {
        units.push(NumberFacet.detail(pointCheck.result))
      }
    }
  }

  if (!omittedFirstParameter && units.length === 0) {
    return { errors }
  }

  const firstUnit = omittedFirstParameter ? previousUnit : units[0]

  const expected = NumberFacet.with(firstUnit).type()
  for (let i = omittedFirstParameter ? 0 : 1; i < units.length; ++i) {
    errors.push(...checkType(expected, NumberFacet.with(units[i]).type(), segment.parameters[i].range))
  }

  return { errors, result: firstUnit }
}

function checkInstrument (scope: Scope, expression: ast.Instrument): Checked<FacetType> {
  const errors: CompileError[] = []

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct an instrument in a realtime context', expression.range))
  }

  const instrumentScope = createLocalScope(scope)

  for (const child of expression.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(instrumentScope, child))
        break

      case 'Voice': {
        const voiceCheck = checkVoice(instrumentScope, child)
        errors.push(...voiceCheck.errors)
        break
      }

      default:
        assertNever(child)
    }
  }

  return { errors, result: InstrumentFacet.type() }
}

function checkVoice (scope: Scope, voice: ast.Voice): Checked<FacetType> {
  const voiceScope = createLocalScope(scope, { blocking: false })
  const errors: CompileError[] = []

  if (voice.bindings.note != null) {
    voiceScope.resolutions.set(voice.bindings.note.name, noteType)
  }

  let hasEnvelope = false
  let hasOutput = false

  for (const child of voice.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(voiceScope, child))
        break

      case 'EnvelopeStatement': {
        if (hasEnvelope) {
          errors.push(new CompileError('Multiple envelope statements in a voice', child.range))
        }

        hasEnvelope = true

        const expressionCheck = checkExpression(voiceScope, child.expression)
        errors.push(...expressionCheck.errors)

        if (expressionCheck.result != null) {
          errors.push(...checkType(CurveFacet.with('db').type(), expressionCheck.result, child.expression.range))
        }

        break
      }

      case 'OutputStatement': {
        if (hasOutput) {
          errors.push(new CompileError('Multiple output statements in a voice', child.range))
        }

        hasOutput = true

        const expressionCheck = checkExpression(voiceScope, child.expression)
        errors.push(...expressionCheck.errors)

        if (expressionCheck.result != null) {
          errors.push(...checkType(SourceFacet.type(), expressionCheck.result, child.expression.range))
        }

        break
      }

      default:
        assertNever(child)
    }
  }

  if (!hasEnvelope) {
    errors.push(new CompileError('Voice is missing an envelope', voice.range))
  }

  if (!hasOutput) {
    errors.push(new CompileError('Voice is missing an output', voice.range))
  }

  return { errors, result: VoiceFacet.type() }
}

function checkMixer (scope: Scope, expression: ast.Mixer): Checked<FacetType> {
  const mixerScope = createLocalScope(scope)
  const errors: CompileError[] = []

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct a mixer in a realtime context', expression.range))
  }

  errors.push(...checkArgumentList(mixerScope, expression.properties, mixerSchema, expression.range, 'property'))

  const busNamespace = nonNull(scope.top.namespaces.get(BUS_NAMESPACE))

  const buses: ast.BusStatement[] = []

  for (const child of expression.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(mixerScope, child))
        break

      case 'BusStatement': {
        const bus = child
        buses.push(bus)

        if (busNamespace.resolutions.has(bus.name.name)) {
          errors.push(new CompileError(`Duplicate bus named "${bus.name.name}"`, bus.range))
        } else if (mixerScope.resolutions.has(bus.name.name)) {
          errors.push(new CompileError(`Bus name "${bus.name.name}" conflicts with existing identifier`, bus.name.range))
        }

        const busCheck = checkBus(mixerScope, bus)
        errors.push(...busCheck.errors)

        const type = busCheck.result ?? BusFacet.type()
        mixerScope.resolutions.set(bus.name.name, type)
        mixerScope.top.buses.set(bus.name.name, type)
        busNamespace.resolutions.set(bus.name.name, type)

        break
      }

      default:
        assertNever(child)
    }
  }

  errors.push(...checkCyclicRoutings(buses.map((bus) => ({
    name: bus.name.name,
    sources: bus.children.filter((child) => child.type === 'Identifier').map((source) => source.name),
    range: bus.name.range
  }))))

  return { errors, result: MixerFacet.type() }
}

function checkBus (scope: Scope, bus: ast.BusStatement): Checked<FacetType> {
  const busScope = createLocalScope(scope)
  const errors: CompileError[] = []

  errors.push(...checkArgumentList(scope, bus.properties, busSchema, bus.range, 'property'))

  const properties = {
    gain: ParameterFacet.with('db').type(),
    pan: ParameterFacet.with(undefined).type()
  }

  const record: Record<string, FacetType> = Object.create(null)
  Object.assign(record, properties)

  for (const child of bus.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(busScope, child))
        break

      case 'Identifier': {
        const sourceCheck = checkExpression(busScope, child)
        errors.push(...sourceCheck.errors)

        if (sourceCheck.result != null) {
          const options = makeUnion(InstrumentFacet.type(), BusFacet.type())
          errors.push(...checkType(options, sourceCheck.result, child.range))
        }

        break
      }

      case 'EffectStatement': {
        const effectCheck = checkExpression(busScope, child.expression)
        errors.push(...effectCheck.errors)

        let effectType: FacetType | undefined

        if (effectCheck.result != null) {
          const typeErrors = checkType(EffectFacet.type(), effectCheck.result, child.expression.range)
          errors.push(...typeErrors)

          if (typeErrors.length === 0) {
            effectType = effectCheck.result
          }
        }

        if (child.name == null) {
          continue
        }

        if (Object.hasOwn(properties, child.name.name)) {
          errors.push(new CompileError(`Effect name "${child.name.name}" conflicts with bus property of the same name`, child.name.range))
          continue
        }

        if (Object.hasOwn(record, child.name.name)) {
          errors.push(new CompileError(`Duplicate effect name "${child.name.name}"`, child.name.range))
          continue
        }

        if (effectType != null) {
          record[child.name.name] = effectType
        }

        break
      }

      default:
        assertNever(child)
    }
  }

  const type = makeType(BusFacet, RecordFacet.with(record))

  return { errors, result: type }
}

function checkTrack (scope: Scope, expression: ast.Track): Checked<FacetType> {
  const trackScope = createLocalScope(scope)
  const errors: CompileError[] = []

  if (!scope.allowedEffects.blocking) {
    errors.push(new CompileError('Cannot construct a track in a realtime context', expression.range))
  }

  errors.push(...checkArgumentList(trackScope, expression.properties, trackSchema, expression.range, 'property'))

  const seenParts = new Set<string>()

  for (const child of expression.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(trackScope, child))
        break

      case 'PartStatement': {
        if (child.name != null) {
          if (seenParts.has(child.name.name)) {
            errors.push(new CompileError(`Duplicate part named "${child.name.name}"`, child.range))
          } else if (trackScope.resolutions.has(child.name.name)) {
            errors.push(new CompileError(`Part name "${child.name.name}" conflicts with existing identifier`, child.name.range))
          }

          seenParts.add(child.name.name)

          // Reserve the name in the local scope
          trackScope.resolutions.set(child.name.name, PartFacet.type())
        }

        errors.push(...checkPart(trackScope, child))
        break
      }

      default:
        assertNever(child)
    }
  }

  return { errors, result: TrackFacet.type() }
}

function checkPart (scope: Scope, part: ast.PartStatement): readonly CompileError[] {
  const partScope = createLocalScope(scope)
  const errors: CompileError[] = []

  errors.push(...checkArgumentList(scope, part.properties, partSchema, part.range, 'property'))

  for (const child of part.children) {
    switch (child.type) {
      case 'Assignment':
        errors.push(...checkAssignment(partScope, child))
        break

      case 'Routing':
        errors.push(...checkInstrumentRouting(partScope, child))
        break

      case 'AutomateStatement':
        errors.push(...checkAutomation(partScope, child))
        break

      default:
        assertNever(child)
    }
  }

  return errors
}

function checkInstrumentRouting (scope: Scope, routing: ast.Routing): readonly CompileError[] {
  const errors: CompileError[] = []

  const destination = resolveInScope(scope, routing.destination.name)
  if (destination == null) {
    errors.push(new CompileError(`Unknown identifier "${routing.destination.name}"`, routing.destination.range))
  } else {
    errors.push(...checkType(InstrumentFacet.type(), destination, routing.destination.range))
  }

  const sourceCheck = checkExpression(scope, routing.source)
  errors.push(...sourceCheck.errors)
  if (sourceCheck.result != null) {
    errors.push(...checkType(PatternFacet.type(), sourceCheck.result, routing.source.range))
  }

  return errors
}

function checkAutomation (scope: Scope, automation: ast.AutomateStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const targetCheck = checkExpression(scope, automation.target)
  errors.push(...targetCheck.errors)
  if (targetCheck.result != null) {
    errors.push(...checkType(ParameterFacet.type(), targetCheck.result, automation.target.range))
  }

  const curveCheck = checkExpression(scope, automation.curve)
  errors.push(...curveCheck.errors)

  if (curveCheck.result == null) {
    return errors
  }

  let curveType = CurveFacet.type()

  if (targetCheck.result != null && ParameterFacet.is(targetCheck.result)) {
    const parameterType = ParameterFacet.detail(targetCheck.result)
    curveType = CurveFacet.with(parameterType).type()
  }

  errors.push(...checkType(curveType, curveCheck.result, automation.curve.range))

  return errors
}

function checkUnaryExpression (scope: Scope, expression: ast.UnaryExpression): Checked<FacetType> {
  const operandCheck = checkExpression(scope, expression.argument)
  const errors = [...operandCheck.errors]

  const operand = operandCheck.result
  if (operand == null) {
    return { errors }
  }

  const result = unaryOperations[expression.operator].check(operand)
  if (result == null) {
    errors.push(new CompileError(`Incompatible operand for "${expression.operator}": ${operand.format()}`, expression.range))
    return { errors }
  }

  return { errors, result }
}

function checkBinaryExpression (scope: Scope, expression: ast.BinaryExpression): Checked<FacetType> {
  const leftCheck = checkExpression(scope, expression.left)
  const rightCheck = checkExpression(scope, expression.right)

  const errors = [...leftCheck.errors, ...rightCheck.errors]

  const left = leftCheck.result
  const right = rightCheck.result

  if (left == null || right == null) {
    return { errors }
  }

  const result = binaryOperations[expression.operator].check(left, right)
  if (result == null) {
    errors.push(new CompileError(`Incompatible operands for "${expression.operator}": ${left.format()} and ${right.format()}`, expression.range))
    return { errors }
  }

  return { errors, result }
}

function checkPropertyAccess (scope: Scope, expression: ast.PropertyAccess): Checked<FacetType> {
  const errors: CompileError[] = []

  if (expression.object.type === 'Identifier') {
    const namespace = scope.top.namespaces.get(expression.object.name)
    if (namespace != null) {
      const propertyType = namespace.resolutions.get(expression.property.name)
      if (propertyType == null) {
        errors.push(new CompileError(`Namespace "${expression.object.name}" has no member named "${expression.property.name}"`, expression.property.range))
        return { errors }
      }

      return { errors, result: propertyType }
    }
  }

  const objectCheck = checkExpression(scope, expression.object)
  errors.push(...objectCheck.errors)

  if (objectCheck.result == null) {
    return { errors }
  }

  const { property } = expression
  const object = objectCheck.result

  if (NumberFacet.is(object)) {
    if (!isSyntaxUnit(property.name)) {
      errors.push(new CompileError(`Unknown unit "${property.name}"`, property.range))
      return { errors }
    }

    const existingUnit = NumberFacet.detail(object)
    if (existingUnit != null) {
      errors.push(new CompileError(`Cannot apply unit "${property.name}" to number with existing unit "${existingUnit}"`, property.range))
      return { errors }
    }

    return { errors, result: NumberFacet.with(toBaseUnit(property.name)).type() }
  }

  if (PatternFacet.is(object)) {
    const builtin = patternBuiltins.get(property.name)
    if (builtin != null) {
      return { errors, result: builtin.type }
    }
  }

  if (RecordFacet.is(object)) {
    const record = RecordFacet.detail(object)
    if (Object.hasOwn(record, property.name)) {
      return { errors, result: record[property.name] }
    }

    // Improve error messages for modules
    if (ModuleFacet.is(object)) {
      const moduleName = ModuleFacet.detail(object).name
      errors.push(new CompileError(`Module "${moduleName}" has no export named "${property.name}"`, property.range))

      return { errors }
    }
  }

  errors.push(new CompileError(`Type ${object.format()} has no property named "${property.name}"`, property.range))

  return { errors }
}

function checkCall (scope: Scope, expression: ast.Call): Checked<FacetType> {
  const errors: CompileError[] = []

  const calleeCheck = checkExpression(scope, expression.callee)
  errors.push(...calleeCheck.errors)

  if (calleeCheck.result == null) {
    return { errors }
  }

  const callee = calleeCheck.result
  if (!FunctionFacet.is(calleeCheck.result)) {
    errors.push(new CompileError(`Cannot call value of type ${callee.format()}`, expression.range))
    return { errors }
  }

  const { parameters, returnType, effects } = FunctionFacet.detail(callee)

  errors.push(...checkArgumentList(scope, expression.arguments, parameters, expression.range))

  if (!scope.allowedEffects.blocking && effects.blocking) {
    const functionName = tryGetFunctionName(expression.callee)
    const message = functionName != null
      ? `Function "${functionName}" may block and cannot be called from a realtime context`
      : `Function may block and cannot be called from a realtime context`
    errors.push(new CompileError(message, expression.range))
  }

  return { errors, result: returnType }
}

function checkArgumentList (
  scope: Scope,
  args: ast.ArgumentList,
  schema: Schema,
  range: SourceRange,
  kind = 'argument'
): readonly CompileError[] {
  const errors: CompileError[] = []

  const seen = new Set<string>()
  let namedStarted = false

  for (let index = 0; index < args.length; ++index) {
    const arg = args[index]

    let spec: SchemaItem | undefined

    if (arg.type === 'Property' || namedStarted) {
      namedStarted = true

      if (arg.type !== 'Property') {
        errors.push(new CompileError(`Unexpected positional ${kind} after named ${kind}s`, arg.range))
        continue
      }

      spec = schema.byName.get(arg.key.name)
      if (spec == null) {
        errors.push(new CompileError(`Unknown ${kind} "${arg.key.name}"`, arg.key.range))
        continue
      }

      if (seen.has(spec.name)) {
        errors.push(new CompileError(`Duplicate ${kind} named "${arg.key.name}"`, arg.key.range))
        continue
      }
    } else {
      spec = schema.items.at(index)
      if (spec == null) {
        errors.push(new CompileError(`Unknown positional ${kind}`, arg.range))
        continue
      }
    }

    seen.add(spec.name)

    const value = arg.type === 'Property' ? arg.value : arg

    const expressionCheck = checkExpression(scope, value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result != null) {
      errors.push(...checkType(spec.type, expressionCheck.result, value.range))
    }
  }

  for (const spec of schema.items) {
    if (spec.required && !seen.has(spec.name)) {
      errors.push(new CompileError(`Missing required ${kind} "${spec.name}"`, range))
    }
  }

  return errors
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
