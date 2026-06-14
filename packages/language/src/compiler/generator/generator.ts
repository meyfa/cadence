import { ast } from '@ast'
import type { Bus, BusId, InstrumentId, InstrumentRouting, Mixer, MixerRouting, Part, Pattern, Program, Step, Track } from '@core'
import { concatPatterns, createParallelPattern, createSerialPattern, mergePatterns } from '@core'
import type { Numeric, Unit } from '@utility'
import { numeric } from '@utility'
import { getStandardModuleValue } from '../../library/modules.js'
import type { Function } from '../../type-system/base/function.js'
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
import { makeType } from '../../type-system/factory.js'
import { Parameters } from '../../type-system/helpers.js'
import type { InferSchema, Schema } from '../../type-system/schema.js'
import type { FacetType, Value } from '../../type-system/types.js'
import type { CheckedProgram } from '../checker/checker.js'
import { BUS_NAMESPACE, busSchema, partSchema, stepSchema, trackSchema } from '../common.js'
import type { CurveSegment as GeneratedCurveSegment } from '../curves.js'
import { createCurve, createCurveSegment, getCurveSegmentType, renderCurvePoints } from '../curves.js'
import { binaryOperations } from '../operators/binary.js'
import { unaryOperations } from '../operators/unary.js'
import { resolveInScope } from '../resolution.js'
import { isSyntaxUnit, toNumberValue } from '../units.js'
import { assert, fail, nonNull } from '../assert.js'
import type { GenerateOptions } from './options.js'
import type { GlobalScope, MutableNamespace, MutableScope, Scope } from './scopes.js'
import { createGlobalScope, createLocalScope, createNamespace } from './scopes.js'
import { patternBuiltins } from '../builtins/patterns.js'

/**
 * Generate a runnable program from an AST. This assumes the AST has already been
 * semantically checked and is valid.
 */
export function generate (program: CheckedProgram, options: GenerateOptions): Program {
  const top = createGlobalScope(options, processImports(program.imports))

  const scope = createLocalScope(top)

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  assert(tracks.length <= 1)
  assert(mixers.length <= 1)

  processAssignments(scope, assignments)

  // Automations in the track may refer to mixer buses, so the mixer must be generated first.
  const mixer = generateMixer(scope, mixers.at(0))

  const track = tracks.length > 0
    ? generateTrack(scope, tracks[0])
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

function clamped<U extends Unit> (value: Numeric<U>, minimum: number, maximum: number): Numeric<U> {
  if (value.value >= minimum && value.value <= maximum) {
    return value
  }

  return {
    unit: value.unit,
    value: Math.min(Math.max(value.value, minimum), maximum)
  }
}

function processImports (imports: readonly ast.UseStatement[]): ReadonlyMap<string, Value> {
  const getModule = (library: ast.String) => {
    assert(library.parts.every((part) => typeof part === 'string'))
    const module = getStandardModuleValue(library.parts.join(''))
    return nonNull(module)
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

function processAssignments (scope: MutableScope, assignments: readonly ast.Assignment[]): void {
  for (const assignment of assignments) {
    assert(!scope.resolutions.has(assignment.key.name))
    scope.resolutions.set(assignment.key.name, resolve(scope, assignment.value))
  }
}

function generateTrack (scope: Scope, track: ast.TrackStatement): Track {
  const { options } = scope.top

  const properties = resolveArgumentList(scope, track.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(NumberFacet.get(properties.tempo), options.tempo.minimum, options.tempo.maximum)
    : numeric('bpm', options.tempo.default)

  const trackScope = createLocalScope(scope)
  processAssignments(trackScope, track.children.filter((c) => c.type === 'Assignment'))

  const parts: Part[] = []

  let currentTime = numeric('beats', 0)
  for (const partStatement of track.children.filter((c) => c.type === 'PartStatement')) {
    const part = generatePart(trackScope, partStatement, currentTime)
    parts.push(part)

    if (part.name != null) {
      assert(!trackScope.resolutions.has(part.name))
      trackScope.resolutions.set(part.name, PartFacet.type().of(part))
    }

    currentTime = numeric('beats', currentTime.value + part.length.value)
  }

  return { tempo, parts }
}

function generatePart (scope: Scope, part: ast.PartStatement, startTime: Numeric<'beats'>): Part {
  const name = part.name?.name
  const properties = resolveArgumentList(scope, part.properties, partSchema)

  const length = clamped(NumberFacet.get(properties.length), 0, Number.POSITIVE_INFINITY)
  const endTime = numeric('beats', startTime.value + length.value)

  const routings = part.routings.map((routing): InstrumentRouting => {
    const source = PatternFacet.get(resolve(scope, routing.source))
    const instrument = InstrumentFacet.get(resolve(scope, routing.destination))

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
    const target = ParameterFacet.get(resolve(scope, automation.target))
    const curve = CurveFacet.get(resolve(scope, automation.curve))

    const rendered = renderCurvePoints(curve, startTime, endTime)
    const existing = nonNull(scope.top.automations.get(target.id), 'Parameter allocated incorrectly')

    const points = [...existing.points, ...rendered].sort((a, b) => a.time.value - b.time.value)

    scope.top.automations.set(target.id, {
      parameterId: target.id,
      points
    })
  }

  return { name, length, routings }
}

function generateMixer (scope: Scope, mixer?: ast.MixerStatement): Mixer {
  const mixerScope = createLocalScope(scope)
  processAssignments(mixerScope, mixer?.children.filter((c) => c.type === 'Assignment') ?? [])

  const namespace = createNamespace()
  scope.top.namespaces.set(BUS_NAMESPACE, namespace)

  const busStatements = mixer?.children.filter((c) => c.type === 'BusStatement') ?? []
  const buses = busStatements.map((bus) => generateBus(mixerScope, bus, namespace))
  const routings = busStatements.flatMap((bus, index) => generateBusRoutings(mixerScope, bus, buses[index]))

  // Implicit output routings for unrouted buses and instruments
  const unroutedBuses = new Set<BusId>(buses.map((b) => b.id))
  const unroutedInstruments = new Set<InstrumentId>(scope.top.instruments.keys())

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

function generateBus (scope: MutableScope, bus: ast.BusStatement, namespace: MutableNamespace): Bus {
  const name = bus.name.name
  const properties = resolveArgumentList(scope, bus.properties, busSchema)

  const effectValues = bus.effects.map((effect) => resolve(scope, effect.expression))
  const effects = effectValues.map((value) => EffectFacet.get(value))

  const valueRecord: Record<string, Value> = Object.create(null)
  const typeRecord: Record<string, FacetType> = Object.create(null)

  for (let i = 0; i < bus.effects.length; ++i) {
    const effectName = bus.effects[i].name?.name
    if (effectName == null) {
      continue
    }

    valueRecord[effectName] = effectValues[i]
    typeRecord[effectName] = effectValues[i].type
  }

  // These must always be allocated even if not explicitly set,
  // as they could still be automated.
  const gainData = properties.gain != null ? NumberFacet.get(properties.gain) : numeric('db', 0)
  const panData = properties.pan != null ? NumberFacet.get(properties.pan) : numeric(undefined, 0)

  const gain = scope.top.allocateParameter(gainData)
  valueRecord.gain = Parameters.of(gain)
  typeRecord.gain = valueRecord.gain.type

  const pan = scope.top.allocateParameter(panData)
  valueRecord.pan = Parameters.of(pan)
  typeRecord.pan = valueRecord.pan.type

  const data = scope.top.allocateBus({ name, gain, pan, effects })
  const value = makeType(BusFacet, RecordFacet.with(typeRecord)).of(data, valueRecord)

  assert(!scope.resolutions.has(name))
  scope.resolutions.set(name, value)

  assert(!namespace.resolutions.has(name))
  namespace.resolutions.set(name, value)

  return data
}

function generateBusRoutings (mixerScope: Scope, bus: ast.BusStatement, destination: Bus): readonly MixerRouting[] {
  return bus.sources.map((identifier) => {
    const source = resolve(mixerScope, identifier)

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

    fail()
  })
}

/**
 * Resolve an expression to a value within the given scope. Since this expression (or sub-expressions) may call
 * functions, the scope may be updated.
 */
function resolve (scope: Scope, expression: ast.Expression): Value {
  switch (expression.type) {
    case 'Number':
      return toNumberValue(scope.top.options, undefined, expression.value)

    case 'String':
      return generateString(scope, expression.parts)

    case 'Pattern':
      return generatePattern(scope, expression)

    case 'Curve':
      return generateCurve(scope, expression)

    case 'Instrument':
      return generateInstrument(scope, expression)

    case 'Identifier':
      return resolveIdentifier(scope, expression)

    case 'UnaryExpression':
      return computeUnaryExpression(scope, expression)

    case 'BinaryExpression':
      return computeBinaryExpression(scope, expression)

    case 'PropertyAccess':
      return resolvePropertyAccess(scope, expression)

    case 'Call':
      return resolveCall(scope, expression)
  }
}

function generateString (scope: Scope, parts: ReadonlyArray<string | ast.Expression>): Value {
  const resolvedParts = parts.map((part) => {
    if (typeof part === 'string') {
      return part
    }

    return StringFacet.get(resolve(scope, part))
  })

  return StringFacet.type().of(resolvedParts.join(''))
}

function generatePattern (scope: Scope, expression: ast.Pattern): Value {
  const subdivision = 1

  const create = expression.mode === 'serial'
    ? (steps: readonly Step[]) => createSerialPattern(steps, subdivision)
    : (steps: readonly Step[]) => createParallelPattern(steps)

  const combine = expression.mode === 'serial'
    ? (patterns: readonly Pattern[]) => concatPatterns(patterns)
    : (patterns: readonly Pattern[]) => mergePatterns(patterns)

  const resolved = expression.children.map((child) => {
    return child.type === 'Step'
      ? generateStep(scope, child)
      : PatternFacet.get(resolve(scope, child))
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

function generateStep (scope: Scope, expression: ast.Step): Step {
  const { value } = expression

  const length = expression.length != null
    ? NumberFacet.with(undefined).get(resolve(scope, expression.length))
    : undefined

  const parameters = resolveArgumentList(scope, expression.parameters, stepSchema)
  const gate = parameters.gate != null ? NumberFacet.get(parameters.gate) : undefined

  if (length == null) {
    return { value, gate }
  }

  return { value, length, gate }
}

function generateCurve (scope: Scope, curve: ast.Curve): Value {
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
      return NumberFacet.get(resolve(scope, point))
    })

    const length = segment.length != null
      ? NumberFacet.with(undefined).get(resolve(scope, segment.length))
      : undefined

    const { parameterCount } = nonNull(getCurveSegmentType(segment.curveType))
    const resolvedParameters = parameters.length < parameterCount
      ? [getPreviousSegmentEnd(), ...parameters]
      : parameters

    generatedSegments.push(createCurveSegment(segment.curveType, resolvedParameters, length))
  }

  return CurveFacet.type().of(createCurve(generatedSegments))
}

function generateInstrument (scope: Scope, expression: ast.Instrument): Value {
  const instrumentScope = createLocalScope(scope)

  for (const child of expression.children) {
    assert(!instrumentScope.resolutions.has(child.key.name))
    instrumentScope.resolutions.set(child.key.name, resolve(instrumentScope, child.value))
  }

  // TODO: Change -Infinity to 0 and expose gain on the record,
  //       once instrument definitions are fully supported.
  const gainValue = numeric('db', -Infinity)
  const gainParameter = scope.top.allocateParameter(gainValue)

  const instrument = scope.top.allocateInstrument({
    gain: gainParameter,
    source: {
      type: 'oscillator',
      shape: 'sine'
    },
    envelope: {
      attack: numeric('s', 0),
      decay: numeric('s', 0),
      sustain: numeric(undefined, 1),
      release: numeric('s', 0)
    }
  })

  return InstrumentFacet.type().of(instrument)
}

function resolveIdentifier (scope: Scope, identifier: ast.Identifier): Value {
  return nonNull(resolveInScope(scope, identifier.name))
}

function computeUnaryExpression (scope: Scope, expression: ast.UnaryExpression): Value {
  return unaryOperations[expression.operator].compute(
    resolve(scope, expression.argument)
  )
}

function computeBinaryExpression (scope: Scope, expression: ast.BinaryExpression): Value {
  return binaryOperations[expression.operator].compute(
    resolve(scope, expression.left),
    resolve(scope, expression.right)
  )
}

function resolvePropertyAccess (scope: Scope, expression: ast.PropertyAccess): Value {
  if (expression.object.type === 'Identifier') {
    const namespace = scope.top.namespaces.get(expression.object.name)
    if (namespace != null) {
      return nonNull(namespace.resolutions.get(expression.property.name))
    }
  }

  const object = resolve(scope, expression.object)
  const property = expression.property.name

  if (NumberFacet.has(object)) {
    assert(isSyntaxUnit(property))
    const numberData = NumberFacet.get(object)
    return toNumberValue(scope.top.options, property, numberData.value)
  }

  if (PatternFacet.has(object)) {
    const builtin = patternBuiltins.get(property)
    if (builtin != null) {
      return builtin.bind(PatternFacet.get(object))
    }
  }

  if (RecordFacet.has(object)) {
    const record = RecordFacet.get(object)
    return nonNull(Object.hasOwn(record, property) ? record[property] : undefined)
  }

  fail()
}

function resolveCall (scope: Scope, expression: ast.Call): Value {
  // cast due to context type
  const func = FunctionFacet.get(resolve(scope, expression.callee)) as Function<Schema, FacetType, GlobalScope>
  const args = resolveArgumentList(scope, expression.arguments, func.parameters)

  return func.invoke(scope.top, args)
}

function resolveArgumentList<S extends Schema> (scope: Scope, args: ast.ArgumentList, schema: S): InferSchema<S> {
  const entries: Array<[string, Value]> = []

  // positionals
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    if (arg.type === 'Property') {
      break
    }

    const { name } = nonNull(schema.items.at(i))
    entries.push([name, resolve(scope, arg)])
  }

  // named
  for (let i = entries.length; i < args.length; ++i) {
    const arg = args[i]
    assert(arg.type === 'Property' && schema.byName.has(arg.key.name))
    entries.push([arg.key.name, resolve(scope, arg.value)])
  }

  return Object.fromEntries(entries) as InferSchema<S>
}
