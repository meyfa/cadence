import type { SourceRange } from '@ast'
import { ast } from '@ast'
import type { Brand, Unit } from '@utility'
import { getStandardModuleNames, getStandardModuleValue } from '../../library/modules.js'
import { CompoundError } from '../../result/errors.js'
import type { Result } from '../../result/result.js'
import { FunctionFacet } from '../../type-system/base/function.js'
import { ModuleFacet } from '../../type-system/base/module.js'
import { NumberFacet } from '../../type-system/base/number.js'
import { RecordFacet } from '../../type-system/base/record.js'
import { StringFacet } from '../../type-system/base/string.js'
import { BusFacet } from '../../type-system/domain/bus.js'
import { CurveFacet } from '../../type-system/domain/curve.js'
import { EffectFacet } from '../../type-system/domain/effect.js'
import { InstrumentFacet } from '../../type-system/domain/instrument.js'
import { ParameterFacet } from '../../type-system/domain/parameter.js'
import { PartFacet } from '../../type-system/domain/part.js'
import { PatternFacet } from '../../type-system/domain/pattern.js'
import { makeType, makeUnion } from '../../type-system/factory.js'
import type { Schema, SchemaItem } from '../../type-system/schema.js'
import type { FacetType, Type, Value } from '../../type-system/types.js'
import { BUS_NAMESPACE, busSchema, mixerSchema, partSchema, stepSchema, trackSchema } from '../common.js'
import { getCurveSegmentType } from '../curves.js'
import { CompileError } from '../error.js'
import { binaryOperations } from '../operators/binary.js'
import { unaryOperations } from '../operators/unary.js'
import { resolveInScope } from '../resolution.js'
import { isSyntaxUnit, toBaseUnit } from '../units.js'
import { checkCyclicRoutings } from './routings.js'
import type { MutableNamespace, MutableScope, Scope } from './scopes.js'
import { createGlobalScope, createLocalScope } from './scopes.js'

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

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  const globalScope = createGlobalScope(importResult.result)
  const scope = createLocalScope(globalScope)

  const errors: CompileError[] = []

  // Order matters, as assignments and mixers populate the scope
  errors.push(...checkAssignments(scope, assignments))
  errors.push(...checkMixers(scope, mixers))
  errors.push(...checkTracks(scope, tracks))

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

function checkAssignments (scope: MutableScope, assignments: readonly ast.Assignment[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const assignment of assignments) {
    const duplicate = scope.resolutions.has(assignment.key.name)
    if (duplicate) {
      errors.push(new CompileError(`Identifier "${assignment.key.name}" is already defined`, assignment.key.range))
    }

    const expressionCheck = checkExpression(scope, assignment.value)
    errors.push(...expressionCheck.errors)

    if (!duplicate && expressionCheck.result != null) {
      scope.resolutions.set(assignment.key.name, expressionCheck.result)
    }
  }

  return errors
}

function checkTracks (scope: MutableScope, tracks: readonly ast.TrackStatement[]): readonly CompileError[] {
  const errors: CompileError[] = []

  for (const track of tracks) {
    if (tracks.length > 1) {
      errors.push(new CompileError('Multiple track definitions', track.range))
    }

    errors.push(...checkTrack(scope, track))
  }

  return errors
}

function checkTrack (scope: MutableScope, track: ast.TrackStatement): readonly CompileError[] {
  const trackScope = createLocalScope(scope)

  const errors: CompileError[] = []

  const seenParts = new Set<string>()

  for (const part of track.parts) {
    if (part.name != null) {
      if (seenParts.has(part.name.name)) {
        errors.push(new CompileError(`Duplicate part named "${part.name.name}"`, part.range))
      } else if (trackScope.resolutions.has(part.name.name)) {
        errors.push(new CompileError(`Part name "${part.name.name}" conflicts with existing identifier`, part.name.range))
      }

      seenParts.add(part.name.name)

      // Reserve the name in the local scope
      trackScope.resolutions.set(part.name.name, PartFacet.type())
    }

    errors.push(...checkPart(trackScope, part))
  }

  const propertiesCheck = checkArgumentList(trackScope, track.properties, trackSchema, track.range, 'property')
  errors.push(...propertiesCheck.errors)

  return errors
}

function checkPart (scope: Scope, part: ast.PartStatement): readonly CompileError[] {
  const errors: CompileError[] = []

  const propertiesCheck = checkArgumentList(scope, part.properties, partSchema, part.range, 'property')
  errors.push(...propertiesCheck.errors)

  for (const routing of part.routings) {
    errors.push(...checkInstrumentRouting(scope, routing))
  }

  for (const automation of part.automations) {
    errors.push(...checkAutomation(scope, automation))
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

function checkMixers (scope: MutableScope, mixers: readonly ast.MixerStatement[]): readonly CompileError[] {
  const busNamespace: MutableNamespace = { resolutions: new Map() }
  scope.top.namespaces.set(BUS_NAMESPACE, busNamespace)

  const errors: CompileError[] = []

  for (const mixer of mixers) {
    if (mixers.length > 1) {
      errors.push(new CompileError('Multiple mixer definitions', mixer.range))
    }

    const mixerCheck = checkMixer(scope, mixer, busNamespace)
    errors.push(...mixerCheck.errors)

    for (const [name, type] of mixerCheck.result?.buses.entries() ?? []) {
      scope.top.buses.set(name, type)
    }
  }

  return errors
}

interface MixerDetail {
  readonly buses: ReadonlyMap<string, FacetType>
}

function checkMixer (scope: Scope, mixer: ast.MixerStatement, busNamespace: MutableNamespace): Checked<MixerDetail> {
  const mixerScope = createLocalScope(scope)

  const errors: CompileError[] = []

  const propertiesCheck = checkArgumentList(mixerScope, mixer.properties, mixerSchema, mixer.range, 'property')
  errors.push(...propertiesCheck.errors)

  const seenBuses = new Map<string, FacetType>()

  const declareBus = (name: string, type: FacetType): void => {
    seenBuses.set(name, type)
    mixerScope.resolutions.set(name, type)
    mixerScope.top.buses.set(name, type)
    busNamespace.resolutions.set(name, type)
  }

  // Build up the list of buses first
  for (const bus of mixer.buses) {
    if (seenBuses.has(bus.name.name)) {
      errors.push(new CompileError(`Duplicate bus named "${bus.name.name}"`, bus.range))
    } else if (mixerScope.resolutions.has(bus.name.name)) {
      errors.push(new CompileError(`Bus name "${bus.name.name}" conflicts with existing identifier`, bus.name.range))
    }

    // reserve a generic type first
    declareBus(bus.name.name, BusFacet.type())
  }

  // Now that all buses are known, we can check the routings
  for (const bus of mixer.buses) {
    const busCheck = checkBus(mixerScope, bus)
    errors.push(...busCheck.errors)

    if (busCheck.result != null) {
      declareBus(bus.name.name, busCheck.result)
    }
  }

  errors.push(...checkCyclicRoutings(mixer.buses.map((bus) => ({
    name: bus.name.name,
    sources: bus.sources.map((s) => s.name),
    range: bus.name.range
  }))))

  return { errors, result: { buses: seenBuses } }
}

function checkBus (scope: Scope, bus: ast.BusStatement): Checked<FacetType> {
  const errors: CompileError[] = []

  const propertiesCheck = checkArgumentList(scope, bus.properties, busSchema, bus.range, 'property')
  errors.push(...propertiesCheck.errors)

  // Sources
  for (const source of bus.sources) {
    const sourceCheck = checkExpression(scope, source)
    errors.push(...sourceCheck.errors)

    if (sourceCheck.result != null) {
      const options = makeUnion(InstrumentFacet.type(), BusFacet.type())
      errors.push(...checkType(options, sourceCheck.result, source.range))
    }
  }

  // Effects
  for (const effect of bus.effects) {
    const effectCheck = checkExpression(scope, effect.expression)
    errors.push(...effectCheck.errors)

    if (effectCheck.result != null) {
      errors.push(...checkType(EffectFacet.type(), effectCheck.result, effect.expression.range))
    }
  }

  const type = makeType(BusFacet, RecordFacet.with({
    gain: ParameterFacet.with('db').type(),
    pan: ParameterFacet.with(undefined).type()
  }))

  return { errors, result: type }
}

function checkExpression (scope: Scope, expression: ast.Expression): Checked<FacetType> {
  switch (expression.type) {
    case 'Number':
      return checkNumber(scope, expression)

    case 'String':
      return checkString(scope, expression)

    case 'Pattern':
      return checkPattern(scope, expression)

    case 'Curve':
      return checkCurve(scope, expression)

    case 'Identifier':
      return checkIdentifier(scope, expression)

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

  const parametersCheck = checkArgumentList(scope, step.parameters, stepSchema, step.range)
  errors.push(...parametersCheck.errors)

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

    if (segmentCheck.errors.length === 0) {
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

function checkCurveSegment (scope: Scope, segment: ast.CurveSegment, hasPrevious: boolean, previousUnit: Unit | undefined): Checked<Unit> {
  const errors: CompileError[] = []

  if (segment.length != null) {
    const lengthCheck = checkExpression(scope, segment.length)
    errors.push(...lengthCheck.errors)

    if (lengthCheck.result != null) {
      errors.push(...checkType(NumberFacet.with(undefined).type(), lengthCheck.result, segment.length.range))
    }
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

  if (errors.length > 0) {
    return { errors }
  }

  const firstUnit = omittedFirstParameter ? previousUnit : units[0]

  const expected = NumberFacet.with(firstUnit).type()
  for (let i = omittedFirstParameter ? 0 : 1; i < units.length; ++i) {
    errors.push(...checkType(expected, NumberFacet.with(units[i]).type(), segment.parameters[i].range))
  }

  return { errors, result: firstUnit }
}

function checkIdentifier (scope: Scope, identifier: ast.Identifier): Checked<FacetType> {
  const valueType = resolveInScope(scope, identifier.name)
  if (valueType == null) {
    return { errors: [new CompileError(`Unknown identifier "${identifier.name}"`, identifier.range)] }
  }

  return { errors: [], result: valueType }
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

  const { parameters, returnType } = FunctionFacet.detail(callee)

  const argumentCheck = checkArgumentList(scope, expression.arguments, parameters, expression.range)
  errors.push(...argumentCheck.errors)

  return { errors, result: returnType }
}

function checkArgumentList (
  scope: Scope,
  args: ast.ArgumentList,
  schema: Schema,
  parentRange: SourceRange,
  kind = 'argument'
): Checked<ReadonlyMap<string, Type>> {
  const errors: CompileError[] = []

  const result = new Map<string, Type>()

  // Remember which argument had errors in their expression check. Otherwise,
  // in addition to reporting the expression's error, we would also report the argument as missing,
  // which is not correct.
  const errorArguments = new Set<string>()

  const schemaAsMap = new Map<string, SchemaItem>(schema.map((spec) => [spec.name, spec]))

  const checkArgumentValue = (spec: SchemaItem, value: ast.Expression): void => {
    const expressionCheck = checkExpression(scope, value)
    errors.push(...expressionCheck.errors)

    if (expressionCheck.result == null) {
      errorArguments.add(spec.name)
      return
    }

    errors.push(...checkType(spec.type, expressionCheck.result, value.range))
    result.set(spec.name, expressionCheck.result)
  }

  let index = 0

  // Positional arguments
  for (; index < args.length; ++index) {
    const arg = args[index]
    if (arg.type === 'Property') {
      break
    }

    const spec = schema.at(index)
    if (spec == null) {
      errors.push(new CompileError(`Unknown positional ${kind}`, arg.range))
      continue
    }

    checkArgumentValue(spec, arg)
  }

  // Named arguments
  for (; index < args.length; ++index) {
    const arg = args[index]
    if (arg.type !== 'Property') {
      errors.push(new CompileError(`Unexpected positional ${kind} after named ${kind}s`, arg.range))
      continue
    }

    const spec = schemaAsMap.get(arg.key.name)
    if (spec == null) {
      errors.push(new CompileError(`Unknown ${kind} "${arg.key.name}"`, arg.key.range))
      continue
    }

    if (result.has(arg.key.name)) {
      errors.push(new CompileError(`Duplicate ${kind} named "${arg.key.name}"`, arg.key.range))
      continue
    }

    checkArgumentValue(spec, arg.value)
  }

  for (const spec of schema) {
    if (spec.required && !result.has(spec.name) && !errorArguments.has(spec.name)) {
      errors.push(new CompileError(`Missing required ${kind} "${spec.name}"`, parentRange))
    }
  }

  return { errors, result: errors.length > 0 ? undefined : result }
}
