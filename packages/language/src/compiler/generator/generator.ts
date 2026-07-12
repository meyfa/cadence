import { ast } from '@ast'
import type { Bus, BusId, Effect, InstrumentId, InstrumentRouting, Mixer, MixerRouting, Part, Pattern, Program, Source, Step, Track, Voice } from '@core'
import { concatPatterns, convertPitchToMidi, createParallelPattern, createSerialPattern, getMidiFrequency, mergePatterns } from '@core'
import type { Numeric, RuntimeNumeric, Unit } from '@utility'
import { runtimeNumeric } from '@utility'
import { getStandardModuleValue } from '../../library/modules.js'
import type { Function } from '../../type-system/base/function.js'
import { FunctionFacet } from '../../type-system/base/function.js'
import { ModuleFacet } from '../../type-system/base/module.js'
import { NumberFacet } from '../../type-system/base/number.js'
import { RecordFacet } from '../../type-system/base/record.js'
import { StringFacet } from '../../type-system/base/string.js'
import { BusFacet } from '../../type-system/domain/bus.js'
import type { Curve, CurveSegment } from '../../type-system/domain/curve.js'
import { CurveFacet } from '../../type-system/domain/curve.js'
import { EffectFacet } from '../../type-system/domain/effect.js'
import { InstrumentFacet } from '../../type-system/domain/instrument.js'
import { ParameterFacet } from '../../type-system/domain/parameter.js'
import { PartFacet } from '../../type-system/domain/part.js'
import { PatternFacet } from '../../type-system/domain/pattern.js'
import { SourceFacet } from '../../type-system/domain/source.js'
import { makeType } from '../../type-system/factory.js'
import { Curves, Numbers, Parameters } from '../../type-system/helpers.js'
import type { InferSchema, Schema } from '../../type-system/schema.js'
import type { FacetType, Value } from '../../type-system/types.js'
import { assert, assertNever, fail, nonNull } from '../assert.js'
import { patternBuiltins } from '../builtins/patterns.js'
import type { CheckedProgram } from '../checker/checker.js'
import type { NoteValue } from '../common.js'
import { BUS_NAMESPACE, busSchema, DEFAULT_ROOT_NOTE, noteType, partSchema, stepSchema, trackSchema } from '../common.js'
import type { RenderCurveOptions } from '../curves.js'
import { createCurve, createCurveSegment, getCurveSegmentType, mergeCurvePoints, renderCurvePoints } from '../curves.js'
import { binaryOperations } from '../operators/binary.js'
import { unaryOperations } from '../operators/unary.js'
import { resolveInScope } from '../resolution.js'
import { isSyntaxUnit, toNumberValue } from '../units.js'
import type { GenerateOptions } from './options.js'
import type { GlobalScope, MutableNamespace, MutableScope, Scope } from './scopes.js'
import { cloneScope, createGlobalScope, createLocalScope, createNamespace } from './scopes.js'

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
    switch (child.type) {
      case 'Assignment':
        processAssignment(scope, child)
        break

      case 'MixerStatement':
        assert(mixer == null)
        mixer = generateMixer(scope, child, busNamespace)
        break

      case 'TrackStatement':
        assert(track == null)
        track = generateTrack(scope, child)
        break

      default:
        assertNever(child)
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

function processAssignment (scope: MutableScope, assignment: ast.Assignment): void {
  assert(!scope.resolutions.has(assignment.key.name))
  scope.resolutions.set(assignment.key.name, resolve(scope, assignment.value))
}

function generateTrack (scope: Scope, track: ast.TrackStatement): Track {
  const { options } = scope.top

  const properties = resolveArgumentList(scope, track.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(NumberFacet.get(properties.tempo), options.tempo.minimum, options.tempo.maximum).value
    : options.tempo.default

  const trackScope = createLocalScope(scope)
  const parts: Part[] = []

  let currentTime = 0 as Numeric<'beats'>

  for (const child of track.children) {
    switch (child.type) {
      case 'Assignment':
        processAssignment(trackScope, child)
        break

      case 'PartStatement': {
        const part = generatePart(trackScope, child, currentTime, tempo)
        parts.push(part)

        if (part.name != null) {
          assert(!trackScope.resolutions.has(part.name))
          trackScope.resolutions.set(part.name, PartFacet.type().of(part))
        }

        currentTime = currentTime + part.length as Numeric<'beats'>
        break
      }

      default:
        assertNever(child)
    }
  }

  return { tempo, parts }
}

function generatePart (scope: Scope, part: ast.PartStatement, startTime: Numeric<'beats'>, tempo: Numeric<'bpm'>): Part {
  const partScope = createLocalScope(scope)

  const name = part.name?.name
  const properties = resolveArgumentList(scope, part.properties, partSchema)
  const length = clamped(NumberFacet.get(properties.length), 0, Number.POSITIVE_INFINITY)

  const routings: InstrumentRouting[] = []

  for (const child of part.children) {
    switch (child.type) {
      case 'Assignment':
        processAssignment(partScope, child)
        break

      case 'Routing':
        routings.push({
          source: {
            type: 'pattern',
            value: PatternFacet.get(resolve(partScope, child.source))
          },

          destination: {
            type: 'instrument',
            id: InstrumentFacet.get(resolve(partScope, child.destination)).id
          }
        })
        break

      case 'AutomateStatement':
        generateAutomation(partScope, child, { offset: runtimeNumeric('beats', startTime), limit: length, tempo })
        break

      default:
        assertNever(child)
    }
  }

  return { name, length: length.value, routings }
}

function generateAutomation (scope: Scope, statement: ast.AutomateStatement, options: RenderCurveOptions): void {
  const target = ParameterFacet.get(resolve(scope, statement.target))
  const curve = CurveFacet.get(resolve(scope, statement.curve))

  const rendered = renderCurvePoints(curve, options)
  const existing = nonNull(scope.top.automations.get(target.id), 'Parameter allocated incorrectly')

  const points = mergeCurvePoints(existing.points, rendered)
  scope.top.automations.set(target.id, { ...existing, points })
}

function generateMixer (scope: Scope, mixer: ast.MixerStatement, busNamespace: MutableNamespace): Mixer {
  const mixerScope = createLocalScope(scope)

  const busStatements: ast.BusStatement[] = []
  const buses: Bus[] = []
  const routings: MixerRouting[] = []

  for (const child of mixer.children) {
    switch (child.type) {
      case 'Assignment':
        processAssignment(mixerScope, child)
        break

      case 'BusStatement': {
        busStatements.push(child)
        const generated = generateBus(mixerScope, child, busNamespace)
        buses.push(generated.bus)
        routings.push(...generated.routings)
        break
      }

      default:
        assertNever(child)
    }
  }

  return { buses, routings }
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

  const createImplicitRouting = (source: MixerRouting['source']) => {
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

interface BusGenerationResult {
  readonly bus: Bus
  readonly routings: readonly MixerRouting[]
}

function generateBus (scope: MutableScope, bus: ast.BusStatement, namespace: MutableNamespace): BusGenerationResult {
  const busScope = createLocalScope(scope)

  const name = bus.name.name
  const properties = resolveArgumentList(scope, bus.properties, busSchema)

  const valueRecord: Record<string, Value> = Object.create(null)
  const typeRecord: Record<string, FacetType> = Object.create(null)

  const sources: Array<MixerRouting['source']> = []
  const effects: Effect[] = []

  for (const child of bus.children) {
    switch (child.type) {
      case 'Assignment':
        processAssignment(busScope, child)
        break

      case 'Identifier': {
        const source = resolve(busScope, child)

        if (InstrumentFacet.has(source)) {
          sources.push({ type: 'instrument', id: InstrumentFacet.get(source).id })
        } else if (BusFacet.has(source)) {
          sources.push({ type: 'bus', id: BusFacet.get(source).id })
        } else {
          fail()
        }

        break
      }

      case 'EffectStatement': {
        const effectValue = resolve(busScope, child.expression)
        effects.push(EffectFacet.get(effectValue))

        const effectName = child.name?.name
        if (effectName != null) {
          valueRecord[effectName] = effectValue
          typeRecord[effectName] = effectValue.type
        }

        break
      }

      default:
        assertNever(child)
    }
  }

  // These must always be allocated even if not explicitly set,
  // as they could still be automated.
  const gainData = properties.gain != null ? NumberFacet.get(properties.gain) : runtimeNumeric('db', 0)
  const panData = properties.pan != null ? NumberFacet.get(properties.pan) : runtimeNumeric(undefined, 0)

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

  const destination = { type: 'bus', id: data.id } as const
  const routings = sources.map((source) => ({
    implicit: false,
    source,
    destination
  }))

  return { bus: data, routings }
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

function resolveIdentifier (scope: Scope, identifier: ast.Identifier): Value {
  return nonNull(resolveInScope(scope, identifier.name))
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

function generateCurve (scope: Scope, curve: ast.Curve): Value {
  const segments = curve.children.filter((c): c is ast.CurveSegment => c.type === 'CurveSegment')
  const otherChildren = curve.children.filter((c) => c.type !== 'CurveSegment')
  assert(segments.length > 0)
  assert(otherChildren.length === 0)

  const generatedSegments: Array<CurveSegment<Unit>> = []

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

  const voiceConstructors: Array<(note: NoteValue, tempo: Numeric<'bpm'>) => readonly Voice[]> = []

  for (const child of expression.children) {
    switch (child.type) {
      case 'Assignment':
        processAssignment(instrumentScope, child)
        break

      case 'VoiceStatement': {
        const frozenScope = cloneScope(instrumentScope)
        voiceConstructors.push((note, tempo) => generateVoice(frozenScope, child, note, tempo))
        break
      }

      default:
        assertNever(child)
    }
  }

  const gainParameter = scope.top.allocateParameter(runtimeNumeric('db', 0))

  const instrument = scope.top.allocateInstrument({
    gain: gainParameter,
    trigger: (note, tempo) => {
      if (voiceConstructors.length === 0) {
        return []
      }

      const gate = Numbers.of(runtimeNumeric('beats', note.gate ?? 0 as Numeric<'beats'>))
      const frequency = Numbers.of(
        runtimeNumeric('hz', getMidiFrequency(note.pitch != null ? convertPitchToMidi(note.pitch) : DEFAULT_ROOT_NOTE))
      )
      const velocity = Numbers.of(runtimeNumeric(undefined, note.velocity))

      const noteBinding = noteType.of({ gate, frequency, velocity })

      return voiceConstructors.flatMap((create) => create(noteBinding, tempo))
    }
  })

  return InstrumentFacet.type().of(instrument)
}

function generateVoice (scope: Scope, voice: ast.VoiceStatement, note: NoteValue, tempo: Numeric<'bpm'>): readonly Voice[] {
  const voiceScope = createLocalScope(scope)

  if (voice.bindings.note != null) {
    assert(!voiceScope.resolutions.has(voice.bindings.note.name))
    voiceScope.resolutions.set(voice.bindings.note.name, note)
  }

  let envelopeValue: Curve<'db'> | undefined
  let outputValue: Source | undefined

  for (const child of voice.children) {
    switch (child.type) {
      case 'Assignment':
        processAssignment(voiceScope, child)
        break

      case 'EnvelopeStatement':
        assert(envelopeValue == null)
        envelopeValue = CurveFacet.with('db').get(resolve(voiceScope, child.expression))
        break

      case 'OutputStatement':
        assert(outputValue == null)
        outputValue = SourceFacet.get(resolve(voiceScope, child.expression))
        break

      default:
        assertNever(child)
    }
  }

  if (outputValue == null || envelopeValue == null) {
    return []
  }

  const envelope = {
    initial: runtimeNumeric('db', -Infinity),
    points: renderCurvePoints(envelopeValue, {
      offset: runtimeNumeric('beats', 0),
      tempo
    })
  }

  return [
    {
      envelope,
      source: outputValue,
      duration: envelope.points.at(-1)?.time.value
    }
  ]
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
