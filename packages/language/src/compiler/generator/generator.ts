import { ast } from '@meyfa/cadence-ast'
import type { Automation, Bus, BusId, Effect, InstrumentId, InstrumentRouting, Mixer, MixerRouting, MixerSource, NoteData, Part, Pattern, Program, RelativeCurve, RelativeCurveSegment, Source, Step, Track, Voice, VoiceInstance } from '@meyfa/cadence-core'
import { beatsToSeconds, concatPatterns, convertPitchToMidi, createParallelPattern, createSerialPattern, getMidiFrequency, mergePatterns } from '@meyfa/cadence-core'
import type { Numeric, RuntimeNumeric, Unit } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import { getStandardModuleValue } from '../../library/modules.ts'
import type { Function } from '../../type-system/base/function.ts'
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
import { makeType } from '../../type-system/factory.ts'
import { Curves, Numbers, Parameters } from '../../type-system/helpers.ts'
import type { InferSchema, Schema } from '../../type-system/schema.ts'
import type { FacetType, Value } from '../../type-system/types.ts'
import { assert, assertNever, fail, nonNull } from '../assert.ts'
import { patternBuiltins } from '../builtins/patterns.ts'
import type { CheckedProgram } from '../checker/checker.ts'
import type { NoteValue } from '../common.ts'
import { BUS_NAMESPACE, busSchema, DEFAULT_ROOT_NOTE, noteType, partSchema, stepSchema, trackSchema } from '../common.ts'
import type { RenderCurveOptions } from '../curves.ts'
import { createCurve, createCurveSegment, getCurveSegmentType, mergeCurvePoints, renderCurvePoints } from '../curves.ts'
import { binaryOperations } from '../operators/binary.ts'
import { unaryOperations } from '../operators/unary.ts'
import { resolveInScope } from '../resolution.ts'
import { isSyntaxUnit, toNumberValue } from '../units.ts'
import type { GenerateOptions } from './options.ts'
import type { GlobalScope, MutableScope, Scope } from './scopes.ts'
import { cloneScope, createGlobalScope, createLocalScope, createNamespace } from './scopes.ts'
import { RecordBuilder } from './properties.ts'

/**
 * Generate a runnable program from an AST. This assumes the AST has already been
 * semantically checked and is valid.
 */
export function generate (program: CheckedProgram, options: GenerateOptions): Program {
  const top = createGlobalScope(options, processImports(program.imports))

  const scope = createLocalScope(top)

  const busNamespace = createNamespace()
  scope.top.namespaces.set(BUS_NAMESPACE, busNamespace)

  let mixer: Mixer | undefined
  let track: Track | undefined

  for (const child of program.children) {
    const { emissions } = processStatement(scope, child)

    for (const emission of emissions) {
      if (MixerFacet.has(emission)) {
        assert(mixer == null)
        mixer = MixerFacet.get(emission)
      } else if (TrackFacet.has(emission)) {
        assert(track == null)
        track = TrackFacet.get(emission)
      } else {
        fail()
      }
    }
  }

  mixer ??= { buses: [], routings: [] }
  track ??= { tempo: options.tempo.default, parts: [] }

  // Implicit output routings for unrouted buses and instruments
  mixer = {
    ...mixer,
    routings: [...mixer.routings, ...generateImplicitRoutings(scope, mixer)]
  }

  return {
    beatsPerBar: options.beatsPerBar,

    instruments: top.instruments,
    automations: top.automations,
    assets: top.assets,

    track,
    mixer
  }
}

function clamped<U extends Unit> (value: RuntimeNumeric<U>, minimum: number, maximum: number): RuntimeNumeric<U> {
  if (value.value >= minimum && value.value <= maximum) {
    return value
  }

  return {
    unit: value.unit,
    value: Math.min(Math.max(value.value, minimum), maximum) as Numeric<U>
  }
}

function processImports (imports: readonly ast.Import[]): ReadonlyMap<string, Value> {
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

interface Statement {
  readonly emissions: readonly Value[]
  readonly properties: ReadonlyMap<string, Value>
}

function processStatement (scope: MutableScope, statement: ast.Statement): Statement {
  const values = statement.values.map((value) => resolve(scope, value))

  if (statement.name != null) {
    assert(values.length === 1)
    assert(!scope.resolutions.has(statement.name.name))
    scope.resolutions.set(statement.name.name, values[0])
  }

  const emissions = statement.emit ? values : []
  const properties = statement.expose
    ? new Map([[statement.name.name, nonNull(values.at(0))]])
    : new Map<string, Value>()

  return { emissions, properties }
}

/**
 * Resolve an expression to a value within the given scope. Since this expression (or sub-expressions) may call
 * functions, the scope may be updated.
 */
function resolve (scope: Scope, expression: ast.Expression): Value {
  switch (expression.type) {
    case 'Identifier':
      return resolveIdentifier(scope, expression)

    case 'Number':
      return toNumberValue(scope.top.options, undefined, expression.value)

    case 'String':
      return generateString(scope, expression)

    case 'Pattern':
      return generatePattern(scope, expression)

    case 'Curve':
      return generateCurve(scope, expression)

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

    case 'Routing':
      return generateRouting(scope, expression)

    case 'Automation':
      return generateAutomation(scope, expression)

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

function resolveIdentifier (scope: Scope, identifier: ast.Identifier): Value {
  return nonNull(resolveInScope(scope, identifier.name))
}

function generateString (scope: Scope, expression: ast.String): Value {
  const resolvedParts = expression.parts.map((part) => {
    if (typeof part === 'string') {
      return part
    }

    return StringFacet.get(resolve(scope, part))
  })

  return StringFacet.type().of(resolvedParts.join(''))
}

function generatePattern (scope: Scope, expression: ast.Pattern): Value {
  const create = expression.mode === 'serial'
    ? (steps: readonly Step[]) => createSerialPattern(steps)
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
    ? NumberFacet.with(undefined).get(resolve(scope, expression.length)).value as unknown as Numeric<'beats'>
    : undefined

  const parameters = resolveArgumentList(scope, expression.parameters, stepSchema)
  const gate = parameters.gate != null
    ? NumberFacet.get(parameters.gate).value as unknown as Numeric<'beats'>
    : undefined
  const velocity = parameters.vel != null
    ? clamped(NumberFacet.get(parameters.vel), 0, 1).value as unknown as Numeric<undefined>
    : undefined

  if (length == null) {
    return { value, gate, velocity }
  }

  return { value, length, gate, velocity }
}

function generateCurve (scope: Scope, expression: ast.Curve): Value {
  const segments = expression.children.filter((c): c is ast.CurveSegment => c.type === 'CurveSegment')
  const otherChildren = expression.children.filter((c) => c.type !== 'CurveSegment')
  assert(segments.length > 0)
  assert(otherChildren.length === 0)

  const generatedSegments: Array<RelativeCurveSegment<Unit>> = []

  const getPreviousSegmentEnd = (): RuntimeNumeric<Unit> => {
    const previous = nonNull(generatedSegments.at(-1))
    const definition = nonNull(getCurveSegmentType(previous.type))
    return definition.end(previous)
  }

  for (const segment of segments) {
    const parameters = segment.parameters.map((point) => {
      return NumberFacet.get(resolve(scope, point))
    })

    const length = (() => {
      const value = NumberFacet.get(resolve(scope, segment.length))
      assert(value.unit === 'beats' || value.unit === 's')
      return value as RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>
    })()

    const { parameterCount } = nonNull(getCurveSegmentType(segment.curveType))
    const resolvedParameters = parameters.length < parameterCount
      ? [getPreviousSegmentEnd(), ...parameters]
      : parameters

    generatedSegments.push(createCurveSegment(segment.curveType, resolvedParameters, length))
  }

  return Curves.of(createCurve(generatedSegments))
}

function generateInstrument (scope: Scope, expression: ast.Instrument): Value {
  const instrumentScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const voices: Voice[] = []

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(instrumentScope, child)
    for (const emission of emissions) {
      voices.push(VoiceFacet.get(emission))
    }
    recordBuilder.putAll(properties)
  }

  const gainParameter = scope.top.allocateParameter('db', 0 as Numeric<'db'>)
  const instrument = scope.top.allocateInstrument({ gain: gainParameter, voices })

  return !recordBuilder.empty
    ? makeType(InstrumentFacet, recordBuilder.facet).of(instrument, recordBuilder.record)
    : InstrumentFacet.type().of(instrument)
}

function generateVoice (scope: Scope, expression: ast.Voice): Value {
  const frozenScope: Scope = cloneScope(scope)

  const invoke: Voice['invoke'] = (note, tempo) => {
    const instanceScope = createLocalScope(frozenScope)

    if (expression.bindings.note != null) {
      const noteBinding = createNoteBinding(note)

      assert(!instanceScope.resolutions.has(expression.bindings.note.name))
      instanceScope.resolutions.set(expression.bindings.note.name, noteBinding)
    }

    return createVoiceInstance(expression, instanceScope, tempo)
  }

  return VoiceFacet.type().of({ invoke })
}

const noteBindingCache = new WeakMap<NoteData, NoteValue>()

function createNoteBinding (note: NoteData): NoteValue {
  const cached = noteBindingCache.get(note)
  if (cached != null) {
    return cached
  }

  const gate = Numbers.of(runtimeNumeric('beats', note.gate ?? 0 as Numeric<'beats'>))
  const frequency = Numbers.of(
    runtimeNumeric('hz', getMidiFrequency(note.pitch != null ? convertPitchToMidi(note.pitch) : DEFAULT_ROOT_NOTE))
  )
  const velocity = Numbers.of(runtimeNumeric(undefined, note.velocity))

  const binding = noteType.of({ gate, frequency, velocity })
  noteBindingCache.set(note, binding)

  return binding
}

function createVoiceInstance (voice: ast.Voice, scope: MutableScope, tempo: Numeric<'bpm'>): VoiceInstance {
  let envelopeValue: RelativeCurve<'db'> | undefined
  let outputValue: Source | undefined

  for (const child of voice.children) {
    const { emissions } = processStatement(scope, child)

    for (const emission of emissions) {
      if (CurveFacet.with('db').has(emission)) {
        assert(envelopeValue == null)
        envelopeValue = CurveFacet.with('db').get(emission)
      } else if (SourceFacet.has(emission)) {
        assert(outputValue == null)
        outputValue = SourceFacet.get(emission)
      } else {
        fail()
      }
    }
  }

  assert(envelopeValue != null)
  assert(outputValue != null)

  const envelope = {
    initial: -Infinity as Numeric<'db'>,
    points: renderCurvePoints(envelopeValue, {
      offset: 0 as Numeric<'s'>,
      tempo
    })
  }

  return {
    envelope,
    source: outputValue,
    duration: envelope.points.at(-1)?.time
  }
}

function generateMixer (scope: Scope, expression: ast.Mixer): Value {
  const mixerScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const buses: Bus[] = []
  const routings: MixerRouting[] = []

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(mixerScope, child)

    for (const emission of emissions) {
      const bus = BusFacet.get(emission)
      buses.push(bus)

      const destination = { type: 'bus', id: bus.id } as const
      routings.push(...bus.sources.map((source) => ({
        implicit: false,
        source,
        destination
      })))
    }

    recordBuilder.putAll(properties)
  }

  const mixer = { buses, routings }

  return !recordBuilder.empty
    ? makeType(MixerFacet, recordBuilder.facet).of(mixer, recordBuilder.record)
    : MixerFacet.type().of(mixer)
}

function generateImplicitRoutings (scope: Scope, mixer: Mixer): readonly MixerRouting[] {
  const routings: MixerRouting[] = []

  const unroutedBuses = new Set<BusId>(mixer.buses.map((b) => b.id))
  const unroutedInstruments = new Set<InstrumentId>(scope.top.instruments.keys())

  for (const routing of mixer.routings) {
    switch (routing.source.type) {
      case 'bus':
        unroutedBuses.delete(routing.source.id)
        break
      case 'instrument':
        unroutedInstruments.delete(routing.source.id)
        break
      default:
        assertNever(routing.source)
    }
  }

  const createImplicitRouting = (source: MixerSource) => {
    routings.push({ implicit: true, source, destination: { type: 'output' } })
  }

  for (const busId of unroutedBuses) {
    createImplicitRouting({ type: 'bus', id: busId })
  }

  for (const instrumentId of unroutedInstruments) {
    createImplicitRouting({ type: 'instrument', id: instrumentId })
  }

  return routings
}

function generateBus (scope: Scope, expression: ast.Bus): Value {
  const busScope = createLocalScope(scope)

  const name = expression.name?.name

  const recordBuilder = new RecordBuilder()
  const sources: MixerSource[] = []
  const effects: Effect[] = []

  const properties = resolveArgumentList(scope, expression.properties, busSchema)

  // These must always be allocated even if not explicitly set,
  // as they could still be automated.
  const gainData = properties.gain != null ? NumberFacet.get(properties.gain).value : 0 as Numeric<'db'>
  const panData = properties.pan != null ? NumberFacet.get(properties.pan).value : 0 as Numeric<undefined>

  const gain = scope.top.allocateParameter('db', gainData)
  const pan = scope.top.allocateParameter(undefined, panData)
  recordBuilder.put('gain', Parameters.of(gain))
  recordBuilder.put('pan', Parameters.of(pan))

  for (const child of expression.children) {
    switch (child.type) {
      case 'Statement': {
        const { emissions, properties } = processStatement(busScope, child)

        for (const emission of emissions) {
          if (InstrumentFacet.has(emission)) {
            sources.push({ type: 'instrument', id: InstrumentFacet.get(emission).id })
          } else if (BusFacet.has(emission)) {
            sources.push({ type: 'bus', id: BusFacet.get(emission).id })
          } else {
            fail()
          }
        }

        recordBuilder.putAll(properties)

        break
      }

      case 'EffectStatement': {
        const effectValue = resolve(busScope, child.expression)
        effects.push(EffectFacet.get(effectValue))

        if (child.name?.name != null) {
          recordBuilder.put(child.name.name, effectValue)
        }

        break
      }

      default:
        assertNever(child)
    }
  }

  const bus = scope.top.allocateBus({ name, sources, gain, pan, effects })
  const value = makeType(BusFacet, recordBuilder.facet).of(bus, recordBuilder.record)

  if (name != null) {
    const namespace = nonNull(scope.top.namespaces.get(BUS_NAMESPACE))
    assert(!namespace.resolutions.has(name))
    namespace.resolutions.set(name, value)
  }

  return value
}

function generateTrack (scope: Scope, expression: ast.Track): Value {
  const { options } = scope.top

  const trackScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const parts: Part[] = []

  const properties = resolveArgumentList(scope, expression.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(NumberFacet.get(properties.tempo), options.tempo.minimum, options.tempo.maximum).value
    : options.tempo.default

  let currentTime = 0 as Numeric<'beats'>

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(trackScope, child)

    for (const emission of emissions) {
      const part = PartFacet.get(emission)
      parts.push(part)

      const automationRenderOptions: RenderCurveOptions = {
        offset: beatsToSeconds(currentTime, tempo),
        limit: beatsToSeconds(part.length, tempo),
        tempo
      }

      for (const automation of part.automations) {
        applyAutomation(scope.top, automation, automationRenderOptions)
      }

      currentTime = currentTime + part.length as Numeric<'beats'>
    }

    recordBuilder.putAll(properties)
  }

  const track = { tempo, parts }

  return !recordBuilder.empty
    ? makeType(TrackFacet, recordBuilder.facet).of(track, recordBuilder.record)
    : TrackFacet.type().of(track)
}

function generatePart (scope: Scope, expression: ast.Part): Value {
  const partScope = createLocalScope(scope)

  const name = expression.name?.name

  const recordBuilder = new RecordBuilder()
  const routings: InstrumentRouting[] = []
  const automations: Automation[] = []

  const properties = resolveArgumentList(scope, expression.properties, partSchema)
  const length = clamped(NumberFacet.get(properties.length), 0, Number.POSITIVE_INFINITY)

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(partScope, child)

    for (const emission of emissions) {
      if (RoutingFacet.has(emission)) {
        routings.push(RoutingFacet.get(emission))
      } else if (AutomationFacet.has(emission)) {
        automations.push(AutomationFacet.get(emission))
      } else {
        fail()
      }
    }

    recordBuilder.putAll(properties)
  }

  const part = { name, length: length.value, routings, automations }

  return !recordBuilder.empty
    ? makeType(PartFacet, recordBuilder.facet).of(part, recordBuilder.record)
    : PartFacet.type().of(part)
}

function generateRouting (scope: Scope, expression: ast.Routing): Value {
  const destination = InstrumentFacet.get(resolve(scope, expression.destination))
  const source = PatternFacet.get(resolve(scope, expression.source))

  return RoutingFacet.type().of({
    destination: { type: 'instrument', id: destination.id },
    source: { type: 'pattern', value: source }
  })
}

function generateAutomation (scope: Scope, expression: ast.Automation): Value {
  const target = ParameterFacet.get(resolve(scope, expression.target))
  const curve = CurveFacet.get(resolve(scope, expression.curve))

  return AutomationFacet.type().of({ parameterId: target.id, curve })
}

function applyAutomation (top: GlobalScope, automation: Automation, options: RenderCurveOptions): void {
  const { parameterId, curve } = automation

  const rendered = renderCurvePoints(curve, options)
  const existing = nonNull(top.automations.get(parameterId), 'Parameter allocated incorrectly')

  const points = mergeCurvePoints(existing.points, rendered)
  top.automations.set(parameterId, { ...existing, points })
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
