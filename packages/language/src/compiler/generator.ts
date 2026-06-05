import { ast } from '@ast'
import type { Automation, Bus, BusId, Instrument, InstrumentId, InstrumentRouting, Mixer, MixerRouting, ParameterId, Part, Pattern, Program, Step, Track } from '@core'
import { concatPatterns, createParallelPattern, createSerialPattern, mergePatterns, multiplyPattern } from '@core'
import type { Numeric, Unit } from '@utility'
import { numeric } from '@utility'
import { FunctionFacet } from '../type-system/base/function.js'
import { ModuleFacet } from '../type-system/base/module.js'
import { NumberFacet } from '../type-system/base/number.js'
import { RecordFacet } from '../type-system/base/record.js'
import { StringFacet } from '../type-system/base/string.js'
import { BusFacet } from '../type-system/domain/bus.js'
import { CurveFacet } from '../type-system/domain/curve.js'
import { EffectFacet } from '../type-system/domain/effect.js'
import { InstrumentFacet } from '../type-system/domain/instrument.js'
import { ParameterFacet } from '../type-system/domain/parameter.js'
import { PartFacet } from '../type-system/domain/part.js'
import { PatternFacet } from '../type-system/domain/pattern.js'
import type { InferSchema, Schema } from '../type-system/schema.js'
import type { Value } from '../type-system/types.js'
import { busSchema, partSchema, stepSchema, trackSchema } from './common.js'
import type { CurveSegment as GeneratedCurveSegment } from './curves.js'
import { createCurve, createCurveSegment, getCurveSegmentType, renderCurvePoints } from './curves.js'
import { CompileError } from './error.js'
import { allocateParameter } from './functions.js'
import { getStandardModuleValue } from './modules.js'
import { BusType, Numbers, Parameters } from './type-helpers.js'
import { isSyntaxUnit, toNumberValue } from './units.js'

export interface GenerateOptions {
  readonly beatsPerBar: number

  readonly tempo: {
    readonly default: number
    readonly minimum: number
    readonly maximum: number
  }
}

/**
 * Generate a runnable program from an AST. This assumes the AST has already been
 * semantically checked and is valid.
 */
export function generate (program: ast.Program, options: GenerateOptions): Program {
  const top = createGlobalScope(options, processImports(program.imports))

  const context = createLocalScope(top)

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  processAssignments(context, assignments)

  // Automations in the track may refer to mixer buses, so the mixer must be generated first.
  const mixer = generateMixer(context, mixers.at(0))

  const track = tracks.length > 0
    ? generateTrack(context, tracks[0])
    : {
        tempo: numeric('bpm', options.tempo.default),
        parts: []
      }

  return {
    beatsPerBar: options.beatsPerBar,

    instruments: top.instruments,
    automations: top.automations,

    track,
    mixer
  }
}

interface Context {
  readonly top: TopLevelContext
  readonly parent?: Context

  readonly resolutions: ReadonlyMap<string, Value>
}

interface TopLevelContext extends Context {
  readonly options: GenerateOptions
  readonly instruments: Map<InstrumentId, Instrument>
  readonly buses: Map<string, Value>
  readonly automations: Map<ParameterId, Automation>
}

interface MutableContext extends Context {
  readonly resolutions: Map<string, Value>
}

function createGlobalScope (options: GenerateOptions, initialResolutions: ReadonlyMap<string, Value>): TopLevelContext {
  const scope: TopLevelContext = {
    get top () {
      return scope
    },
    options,
    instruments: new Map(),
    buses: new Map(),
    automations: new Map(),
    resolutions: new Map(initialResolutions)
  }

  return scope
}

function createLocalScope (parent: Context): MutableContext {
  return {
    top: parent.top,
    parent,
    resolutions: new Map()
  }
}

function assert (condition: boolean): asserts condition {
  if (!condition) {
    throw new CompileError('Internal compiler error (should have been caught in semantic analysis)')
  }
}

function nonNull<T> (value: T | null | undefined): NonNullable<T> {
  assert(value != null)
  return value
}

function clamped<U extends Unit> (value: Numeric<U>, minimum: number, maximum: number): Numeric<U> {
  return value.value < minimum || value.value > maximum
    ? { unit: value.unit, value: Math.min(Math.max(value.value, minimum), maximum) }
    : value
}

function processImports (imports: readonly ast.UseStatement[]): ReadonlyMap<string, Value> {
  const getModule = (library: ast.String) => {
    // Checker guarantees this is a simple string
    const name = library.parts.filter((part) => typeof part === 'string').join('')
    return nonNull(getStandardModuleValue(name))
  }

  const result = new Map<string, Value>()

  // Process default imports first, such that aliases can override them

  for (const statement of imports) {
    if (statement.alias == null) {
      const { exports } = ModuleFacet.get(getModule(statement.library))
      for (const [name, value] of exports) {
        result.set(name, value)
      }
    }
  }

  for (const statement of imports) {
    if (statement.alias != null) {
      result.set(statement.alias, getModule(statement.library))
    }
  }

  return result
}

function processAssignments (context: MutableContext, assignments: readonly ast.Assignment[]): void {
  for (const assignment of assignments) {
    assert(!context.resolutions.has(assignment.key.name))
    context.resolutions.set(assignment.key.name, resolve(context, assignment.value))
  }
}

function generateTrack (context: Context, track: ast.TrackStatement): Track {
  const { options } = context.top

  const trackContext = createLocalScope(context)

  const parts: Part[] = []

  let currentTime = numeric('beats', 0)
  for (const partStatement of track.parts) {
    const part = generatePart(trackContext, partStatement, currentTime)
    parts.push(part)

    assert(!trackContext.resolutions.has(part.name))
    trackContext.resolutions.set(part.name, PartFacet.type().of(part))

    currentTime = numeric('beats', currentTime.value + part.length.value)
  }

  const properties = resolveArgumentList(trackContext, track.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(NumberFacet.get(properties.tempo), options.tempo.minimum, options.tempo.maximum)
    : numeric('bpm', options.tempo.default)

  return { tempo, parts }
}

function generatePart (context: Context, part: ast.PartStatement, startTime: Numeric<'beats'>): Part {
  const name = part.name.name
  const properties = resolveArgumentList(context, part.properties, partSchema)

  const length = clamped(NumberFacet.get(properties.length), 0, Number.POSITIVE_INFINITY)
  const endTime = numeric('beats', startTime.value + length.value)

  const routings = part.routings.map((routing): InstrumentRouting => {
    const source = PatternFacet.get(resolve(context, routing.source))
    const instrument = InstrumentFacet.get(resolve(context, routing.destination))

    return {
      source: {
        type: 'pattern',
        value: source
      },

      destination: {
        type: 'instrument',
        id: instrument.id
      }
    }
  })

  for (const automation of part.automations) {
    const target = ParameterFacet.get(resolve(context, automation.target))
    const curve = CurveFacet.get(resolve(context, automation.curve))

    const rendered = renderCurvePoints(curve, startTime, endTime)
    const existing = context.top.automations.get(target.id)

    const points = existing == null
      ? rendered
      : [...existing.points, ...rendered].sort((a, b) => a.time.value - b.time.value)

    context.top.automations.set(target.id, {
      parameterId: target.id,
      points
    })
  }

  return { name, length, routings }
}

function generateMixer (context: Context, mixer?: ast.MixerStatement): Mixer {
  const mixerContext = createLocalScope(context)

  const buses = mixer?.buses.map((bus, index) => generateBus(mixerContext, bus, index as BusId)) ?? []
  const routings: MixerRouting[] = []

  if (mixer != null) {
    for (const bus of buses) {
      assert(!mixerContext.resolutions.has(bus.name))
      const busValue = BusType.of(bus, {
        gain: Parameters.of(bus.gain),
        pan: Parameters.of(bus.pan)
      })
      mixerContext.resolutions.set(bus.name, busValue)
      context.top.buses.set(bus.name, busValue)
    }

    for (const bus of mixer.buses) {
      routings.push(...generateBusRoutings(mixerContext, bus, buses))
    }
  }

  // Implicit output routings for unrouted buses and instruments
  const unroutedBuses = new Set<BusId>(buses.map((b) => b.id))
  const unroutedInstruments = new Set<InstrumentId>(context.top.instruments.keys())

  for (const routing of routings) {
    switch (routing.source.type) {
      case 'bus':
        unroutedBuses.delete(routing.source.id)
        break
      case 'instrument':
        unroutedInstruments.delete(routing.source.id)
        break
    }
  }

  const createImplicitRouting = (source: MixerRouting['source']) => {
    routings.push({ implicit: true, source, destination: { type: 'output' } })
  }

  for (const busId of unroutedBuses) {
    createImplicitRouting({ type: 'bus', id: busId })
  }

  for (const instrumentId of unroutedInstruments) {
    createImplicitRouting({ type: 'instrument', id: instrumentId })
  }

  return { buses, routings }
}

function generateBus (context: Context, bus: ast.BusStatement, id: BusId): Bus {
  const name = bus.name.name
  const properties = resolveArgumentList(context, bus.properties, busSchema)

  const effects = bus.effects.map((effect) => {
    return EffectFacet.get(resolve(context, effect.expression))
  })

  // These must always be allocated even if not explicitly set,
  // as they could still be automated.
  const gainData = properties.gain != null ? NumberFacet.get(properties.gain) : numeric('db', 0)
  const panData = properties.pan != null ? NumberFacet.get(properties.pan) : numeric(undefined, 0)

  const gain = allocateParameter(context.top, gainData)
  const pan = allocateParameter(context.top, panData)

  return { id, name, gain, pan, effects }
}

function generateBusRoutings (mixerContext: Context, bus: ast.BusStatement, buses: readonly Bus[]): readonly MixerRouting[] {
  const destination = nonNull(buses.find((b) => b.name === bus.name.name))

  return bus.sources.map((identifier) => {
    const source = resolve(mixerContext, identifier)

    const toRouting = (src: { type: 'instrument' | 'bus', id: InstrumentId | BusId }): MixerRouting => ({
      implicit: false,
      source: src.type === 'instrument'
        ? { type: 'instrument', id: src.id as InstrumentId }
        : { type: 'bus', id: src.id as BusId },
      destination: { type: 'bus', id: destination.id }
    })

    if (InstrumentFacet.has(source)) {
      return toRouting({ type: 'instrument', id: InstrumentFacet.get(source).id })
    }

    if (BusFacet.has(source)) {
      return toRouting({ type: 'bus', id: BusFacet.get(source).id })
    }

    assert(false)
  })
}

/**
 * Resolve an expression to a value within the given context. Since this expression (or sub-expressions) may call
 * functions, the context may be updated.
 */
function resolve (context: Context, expression: ast.Expression): Value {
  switch (expression.type) {
    case 'Number':
      return toNumberValue(context.top.options, undefined, expression.value)

    case 'String':
      return generateString(context, expression.parts)

    case 'Pattern':
      return generatePattern(context, expression)

    case 'Curve':
      return generateCurve(context, expression)

    case 'Identifier':
      return resolveIdentifier(context, expression)

    case 'UnaryExpression':
      return computeUnaryExpression(context, expression)

    case 'BinaryExpression':
      return computeBinaryExpression(context, expression)

    case 'PropertyAccess':
      return resolvePropertyAccess(context, expression)

    case 'Call':
      return resolveCall(context, expression)
  }
}

function generateString (context: Context, parts: ReadonlyArray<string | ast.Expression>): Value {
  const resolvedParts = parts.map((part) => {
    return typeof part === 'string'
      ? part
      : StringFacet.get(resolve(context, part))
  })

  return StringFacet.type().of(resolvedParts.join(''))
}

function generatePattern (context: Context, expression: ast.Pattern): Value {
  const subdivision = 1

  const create = expression.mode === 'serial'
    ? (steps: readonly Step[]) => createSerialPattern(steps, subdivision)
    : (steps: readonly Step[]) => createParallelPattern(steps)

  const combine = expression.mode === 'serial'
    ? (patterns: readonly Pattern[]) => concatPatterns(patterns)
    : (patterns: readonly Pattern[]) => mergePatterns(patterns)

  const resolved = expression.children.map((child) => {
    return child.type === 'Step'
      ? generateStep(context, child)
      : PatternFacet.get(resolve(context, child))
  })

  const isStep = (item: Step | Pattern): item is Step => 'value' in item
  const stepCount = resolved.filter(isStep).length

  // all steps or empty pattern
  if (stepCount === resolved.length) {
    return PatternFacet.type().of(create(resolved as readonly Step[]))
  }

  // all sub-patterns
  if (stepCount === 0) {
    return PatternFacet.type().of(combine(resolved as readonly Pattern[]))
  }

  // general case (mixed steps and sub-patterns)
  const patterns = resolved.map((child) => {
    return isStep(child) ? create([child]) : child
  })

  return PatternFacet.type().of(combine(patterns))
}

function generateStep (context: Context, expression: ast.Step): Step {
  const { value } = expression

  const length = expression.length != null
    ? NumberFacet.with(undefined).get(resolve(context, expression.length))
    : undefined

  const parameters = resolveArgumentList(context, expression.parameters, stepSchema)
  const gate = parameters.gate != null ? NumberFacet.get(parameters.gate) : undefined

  if (length == null) {
    return { value, gate }
  }

  return { value, length, gate }
}

function generateCurve (context: Context, curve: ast.Curve): Value {
  const segments = curve.children.filter((c): c is ast.CurveSegment => c.type === 'CurveSegment')
  const otherChildren = curve.children.filter((c) => c.type !== 'CurveSegment')
  assert(segments.length > 0)
  assert(otherChildren.length === 0)

  const generatedSegments: Array<GeneratedCurveSegment<Unit>> = []

  const getPreviousSegmentEnd = (): Numeric<Unit> => {
    const previous = nonNull(generatedSegments.at(-1))
    const definition = nonNull(getCurveSegmentType(previous.type))
    return definition.end(previous)
  }

  for (const segment of segments) {
    const parameters = segment.parameters.map((point) => {
      return NumberFacet.get(resolve(context, point))
    })

    const length = segment.length != null
      ? NumberFacet.with(undefined).get(resolve(context, segment.length))
      : undefined

    const { parameterCount } = nonNull(getCurveSegmentType(segment.curveType))
    const resolvedParameters = parameters.length < parameterCount
      ? [getPreviousSegmentEnd(), ...parameters]
      : parameters

    generatedSegments.push(createCurveSegment(segment.curveType, resolvedParameters, length))
  }

  return CurveFacet.type().of(
    createCurve(generatedSegments)
  )
}

function resolveIdentifier (context: Context, identifier: ast.Identifier): Value {
  let current: Context | undefined = context

  while (current != null) {
    const value = current.resolutions.get(identifier.name)
    if (value != null) {
      return value
    }
    current = current.parent
  }

  throw new CompileError(`Unknown identifier "${identifier.name}"`, identifier.range)
}

function computeUnaryExpression (context: Context, expression: ast.UnaryExpression): Value {
  const argument = resolve(context, expression.argument)

  switch (expression.operator) {
    case '+':
      if (NumberFacet.has(argument)) {
        return argument
      }
      break

    case '-':
      if (NumberFacet.has(argument)) {
        const numberData = NumberFacet.get(argument)
        return Numbers.of({ unit: numberData.unit, value: -numberData.value })
      }
      break
  }

  assert(false)
}

function computeBinaryExpression (context: Context, expression: ast.BinaryExpression): Value {
  const left = resolve(context, expression.left)
  const right = resolve(context, expression.right)

  switch (expression.operator) {
    case '+':
      return computePlus(left, right)
    case '-':
      return computeMinus(left, right)
    case '*':
      return computeMultiply(left, right)
    case '/':
      return computeDivide(left, right)
  }
}

function computePlus (left: Value, right: Value): Value {
  if (StringFacet.has(left) && StringFacet.has(right)) {
    const leftData = StringFacet.get(left)
    const rightData = StringFacet.get(right)
    return StringFacet.type().of(leftData + rightData)
  }

  if (PatternFacet.has(left) && PatternFacet.has(right)) {
    const leftData = PatternFacet.get(left)
    const rightData = PatternFacet.get(right)
    return PatternFacet.type().of(concatPatterns([leftData, rightData]))
  }

  if (NumberFacet.has(left) && NumberFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = NumberFacet.get(right)
    return Numbers.of({ unit: leftData.unit, value: leftData.value + rightData.value })
  }

  assert(false)
}

function computeMinus (left: Value, right: Value): Value {
  if (NumberFacet.has(left) && NumberFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = NumberFacet.get(right)
    return Numbers.of({ unit: leftData.unit, value: leftData.value - rightData.value })
  }

  assert(false)
}

function computeMultiply (left: Value, right: Value): Value {
  if (NumberFacet.has(left) && NumberFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = NumberFacet.get(right)
    return Numbers.of({ unit: leftData.unit ?? rightData.unit, value: leftData.value * rightData.value })
  }

  if (PatternFacet.has(left) && NumberFacet.has(right)) {
    const leftData = PatternFacet.get(left)
    const rightData = NumberFacet.get(right)
    return PatternFacet.type().of(multiplyPattern(leftData, rightData.value))
  }

  if (NumberFacet.has(left) && PatternFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = PatternFacet.get(right)
    return PatternFacet.type().of(multiplyPattern(rightData, leftData.value))
  }

  assert(false)
}

function computeDivide (left: Value, right: Value): Value {
  if (NumberFacet.has(left) && NumberFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = NumberFacet.get(right)
    // Equal units cancel out
    const unit = leftData.unit === rightData.unit ? undefined : leftData.unit
    return Numbers.of({ unit, value: leftData.value / rightData.value })
  }

  if (PatternFacet.has(left) && NumberFacet.has(right)) {
    const leftData = PatternFacet.get(left)
    const rightData = NumberFacet.get(right)
    return PatternFacet.type().of(multiplyPattern(leftData, 1.0 / rightData.value))
  }

  assert(false)
}

function resolvePropertyAccess (context: Context, expression: ast.PropertyAccess): Value {
  // Special case: "bus" namespace
  if (expression.object.type === 'Identifier' && expression.object.name === 'bus') {
    return nonNull(context.top.buses.get(expression.property.name))
  }

  const object = resolve(context, expression.object)
  const property = expression.property.name

  if (NumberFacet.has(object)) {
    assert(isSyntaxUnit(property))
    const numberData = NumberFacet.get(object)
    return toNumberValue(context.top.options, property, numberData.value)
  }

  if (RecordFacet.has(object)) {
    const record = RecordFacet.get(object)
    return nonNull(Object.hasOwn(record, property) ? record[property] : undefined)
  }

  assert(false)
}

function resolveCall (context: Context, expression: ast.Call): Value {
  const func = FunctionFacet.get(resolve(context, expression.callee))
  const args = resolveArgumentList(context, expression.arguments, func.parameters)

  return func.invoke(context.top, args)
}

function resolveArgumentList<S extends Schema> (context: Context, args: ast.ArgumentList, schema: S): InferSchema<S> {
  const entries: Array<[string, Value]> = []

  // positionals
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    if (arg.type === 'Property') {
      break
    }

    const param = schema.at(i)
    assert(param != null)

    entries.push([param.name, resolve(context, arg)])
  }

  // named
  for (let i = entries.length; i < args.length; ++i) {
    const arg = args[i]
    assert(arg.type === 'Property')

    const param = schema.find((s) => s.name === arg.key.name)
    assert(param != null)

    entries.push([param.name, resolve(context, arg.value)])
  }

  return Object.fromEntries(entries) as InferSchema<S>
}
