import { concatPatterns, createParallelPattern, createSerialPattern, mergePatterns, multiplyPattern } from '@core/pattern.js'
import { makeNumeric, type Automation, type Bus, type BusId, type Instrument, type InstrumentId, type InstrumentRouting, type Mixer, type MixerRouting, type Numeric, type ParameterId, type Part, type Pattern, type Program, type Step, type Track, type Unit } from '@core/program.js'
import * as ast from '../parser/ast.js'
import { busSchema, partSchema, stepSchema, trackSchema } from './common.js'
import { CompileError } from './error.js'
import { getStandardModule } from './modules.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { BusType, EffectType, FunctionType, GroupType, InstrumentType, NumberType, PartType, PatternType, StringType, type BusValue, type GroupValue, type InstrumentValue, type PatternValue, type StringValue, type Type, type Value } from './types.js'
import { toNumberValue } from './units.js'

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

  const track = tracks.length > 0
    ? generateTrack(context, tracks[0])
    : {
        tempo: makeNumeric('bpm', options.tempo.default),
        parts: []
      }

  const mixer = mixers.length > 0
    ? generateMixer(context, mixers[0])
    : { buses: [], routings: [] }

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
    ? makeNumeric(value.unit, Math.min(Math.max(value.value, minimum), maximum))
    : value
}

function processImports (imports: readonly ast.UseStatement[]): ReadonlyMap<string, Value> {
  const getModule = (library: ast.String) => {
    // Checker guarantees this is a simple string
    const name = library.parts.filter((part) => typeof part === 'string').join('')

    const module = getStandardModule(name)
    assert(module != null)

    return module
  }

  const result = new Map<string, Value>()

  // Process default imports first, such that aliases can override them

  for (const statement of imports) {
    if (statement.alias == null) {
      for (const [name, value] of getModule(statement.library).data.exports) {
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

  const parts = track.parts.map((part) => generatePart(trackContext, part))
  for (const part of parts) {
    assert(!trackContext.resolutions.has(part.name))
    trackContext.resolutions.set(part.name, PartType.of(part))
  }

  const properties = resolveArgumentList(trackContext, track.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(properties.tempo, options.tempo.minimum, options.tempo.maximum)
    : makeNumeric('bpm', options.tempo.default)

  return { tempo, parts }
}

function generatePart (context: Context, part: ast.PartStatement): Part {
  const name = part.name.name
  const properties = resolveArgumentList(context, part.properties, partSchema)

  const routings = part.routings.map((routing): InstrumentRouting => {
    const source = PatternType.cast(resolve(context, routing.source))
    const instrument = InstrumentType.cast(resolve(context, routing.destination))

    return {
      source: {
        type: 'Pattern',
        value: source.data
      },

      destination: {
        type: 'Instrument',
        id: instrument.data.id
      }
    }
  })

  return {
    name,
    length: clamped(properties.length, 0, Number.POSITIVE_INFINITY),
    routings
  }
}

function generateMixer (context: Context, mixer: ast.MixerStatement): Mixer {
  const mixerContext = createLocalScope(context)

  const buses = mixer.buses.map((bus, index) => generateBus(mixerContext, bus, index as BusId))

  for (const bus of buses) {
    assert(!mixerContext.resolutions.has(bus.name))
    mixerContext.resolutions.set(bus.name, BusType.of(bus))
  }

  const routings: MixerRouting[] = []

  for (const bus of mixer.buses) {
    routings.push(...generateBusRoutings(mixerContext, bus, buses))
  }

  // Implicit output routings for unrouted buses and instruments
  const unroutedBuses = new Set<BusId>(buses.map((b) => b.id))
  const unroutedInstruments = new Set<InstrumentId>(context.top.instruments.keys())

  for (const routing of routings) {
    switch (routing.source.type) {
      case 'Bus':
        unroutedBuses.delete(routing.source.id)
        break
      case 'Instrument':
        unroutedInstruments.delete(routing.source.id)
        break
    }
  }

  const createImplicitRouting = (source: MixerRouting['source']) => {
    routings.push({ implicit: true, source, destination: { type: 'Output' } })
  }

  for (const busId of unroutedBuses) {
    createImplicitRouting({ type: 'Bus', id: busId })
  }

  for (const instrumentId of unroutedInstruments) {
    createImplicitRouting({ type: 'Instrument', id: instrumentId })
  }

  return { buses, routings }
}

function generateBus (context: Context, bus: ast.BusStatement, id: BusId): Bus {
  const name = bus.name.name
  const properties = resolveArgumentList(context, bus.properties, busSchema)

  const effects = bus.effects.map((effect) => {
    return EffectType.cast(resolve(context, effect.expression)).data
  })

  return { id, name, ...properties, effects }
}

function generateBusRoutings (mixerContext: Context, bus: ast.BusStatement, buses: readonly Bus[]): MixerRouting[] {
  const destination = nonNull(buses.find((b) => b.name === bus.name.name))

  return bus.sources.flatMap((identifier) => {
    const source = resolve(mixerContext, identifier)

    const toRouting = (src: { type: Type['name'], id: InstrumentId | BusId }): MixerRouting => ({
      implicit: false,
      source: src.type === 'instrument'
        ? { type: 'Instrument', id: src.id as InstrumentId }
        : { type: 'Bus', id: src.id as BusId },
      destination: { type: 'Bus', id: destination.id }
    })

    if (InstrumentType.is(source)) {
      return [toRouting({ type: InstrumentType.name, id: source.data.id })]
    }

    if (BusType.is(source)) {
      return [toRouting({ type: BusType.name, id: source.data.id })]
    }

    if (GroupType.is(source)) {
      return source.data.map((part) => toRouting({ type: part.type.name, id: part.data.id }))
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
      return toNumberValue(context.top.options, expression)

    case 'String':
      return generateString(context, expression.parts)

    case 'Pattern':
      return generatePattern(context, expression)

    case 'Identifier': {
      let current: Context | undefined = context

      while (current != null) {
        const value = current.resolutions.get(expression.name)
        if (value != null) {
          return value
        }
        current = current.parent
      }

      throw new CompileError(`Unknown identifier "${expression.name}"`, expression.range)
    }

    case 'UnaryExpression': {
      const arg = resolve(context, expression.argument)
      return computeUnaryExpression(expression.operator, arg)
    }

    case 'BinaryExpression': {
      const left = resolve(context, expression.left)
      const right = resolve(context, expression.right)
      return computeBinaryExpression(expression.operator, left, right)
    }

    case 'PropertyAccess': {
      const object = resolve(context, expression.object)
      return nonNull(object.type.propertyValue(object, expression.property.name)) as Value
    }

    case 'Call': {
      const func = FunctionType.cast(resolve(context, expression.callee))
      const args = resolveArgumentList(context, expression.arguments, func.data.arguments)
      return func.data.invoke(context.top, args)
    }
  }
}

function generateString (context: Context, parts: ReadonlyArray<string | ast.Expression>): StringValue {
  const resolvedParts = parts.map((part) => {
    return typeof part === 'string'
      ? part
      : StringType.cast(resolve(context, part)).data
  })

  return StringType.of(resolvedParts.join(''))
}

function generatePattern (context: Context, expression: ast.Pattern): PatternValue {
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
      : PatternType.cast(resolve(context, child)).data
  })

  const isStep = (item: Step | Pattern): item is Step => 'value' in item
  const stepCount = resolved.filter(isStep).length

  // all steps or empty pattern
  if (stepCount === resolved.length) {
    return PatternType.of(create(resolved as readonly Step[]))
  }

  // all sub-patterns
  if (stepCount === 0) {
    return PatternType.of(combine(resolved as readonly Pattern[]))
  }

  // general case (mixed steps and sub-patterns)
  const patterns = resolved.map((child) => {
    return isStep(child) ? create([child]) : child
  })

  return PatternType.of(combine(patterns))
}

function generateStep (context: Context, expression: ast.Step): Step {
  const { value } = expression

  const length = expression.length != null
    ? NumberType.with(undefined).cast(resolve(context, expression.length)).data
    : undefined

  const parameters = resolveArgumentList(context, expression.parameters, stepSchema)

  if (length == null) {
    return { value, ...parameters }
  }

  return { value, length, ...parameters }
}

function computeUnaryExpression (operator: ast.UnaryOperator, argument: Value): Value {
  switch (operator) {
    case '+':
      if (NumberType.is(argument)) {
        return argument
      }
      break

    case '-':
      if (NumberType.is(argument)) {
        return NumberType.of({ unit: argument.data.unit, value: -argument.data.value })
      }
      break
  }

  assert(false)
}

function computeBinaryExpression (operator: ast.BinaryOperator, left: Value, right: Value): Value {
  switch (operator) {
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
  if (StringType.is(left) && StringType.is(right)) {
    return StringType.of(left.data + right.data)
  }

  if (PatternType.is(left) && PatternType.is(right)) {
    return PatternType.of(concatPatterns([left.data, right.data]))
  }

  if (NumberType.is(left) && NumberType.is(right)) {
    return NumberType.of({ unit: left.data.unit, value: left.data.value + right.data.value })
  }

  type Summable = InstrumentValue | BusValue | GroupValue
  const isSummable = (value: Value) => InstrumentType.is(value) || BusType.is(value) || GroupType.is(value)
  const getSumComponents = (value: Summable) => GroupType.is(value) ? value.data : [value]

  if (isSummable(left) && isSummable(right)) {
    return GroupType.of([...getSumComponents(left), ...getSumComponents(right)])
  }

  assert(false)
}

function computeMinus (left: Value, right: Value): Value {
  if (NumberType.is(left) && NumberType.is(right)) {
    return NumberType.of({ unit: left.data.unit, value: left.data.value - right.data.value })
  }

  assert(false)
}

function computeMultiply (left: Value, right: Value): Value {
  if (NumberType.is(left) && NumberType.is(right)) {
    return NumberType.of({ unit: left.data.unit ?? right.data.unit, value: left.data.value * right.data.value })
  }

  if (PatternType.is(left) && NumberType.is(right)) {
    return PatternType.of(multiplyPattern(left.data, right.data.value))
  }

  if (NumberType.is(left) && PatternType.is(right)) {
    return PatternType.of(multiplyPattern(right.data, left.data.value))
  }

  assert(false)
}

function computeDivide (left: Value, right: Value): Value {
  if (NumberType.is(left) && NumberType.is(right)) {
    // Equal units cancel out
    const unit = left.data.unit === right.data.unit ? undefined : left.data.unit
    return NumberType.of({ unit, value: left.data.value / right.data.value })
  }

  if (PatternType.is(left) && NumberType.is(right)) {
    return PatternType.of(multiplyPattern(left.data, 1.0 / right.data.value))
  }

  assert(false)
}

function resolveArgumentList<S extends PropertySchema> (context: Context, args: ast.ArgumentList, schema: S): InferSchema<S> {
  const entries: Array<[string, Value['data']]> = []

  // positionals
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    if (arg.type === 'Property') {
      break
    }

    const param = schema.at(i)
    assert(param != null)

    entries.push([param.name, resolve(context, arg).data])
  }

  // named
  for (let i = entries.length; i < args.length; ++i) {
    const arg = args[i]
    assert(arg.type === 'Property')

    const param = schema.find((s) => s.name === arg.key.name)
    assert(param != null)

    entries.push([param.name, resolve(context, arg.value).data])
  }

  return Object.fromEntries(entries) as InferSchema<S>
}
