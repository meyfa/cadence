import { concatPatterns, createPattern, multiplyPattern } from '@core/pattern.js'
import { makeNumeric, type Bus, type BusId, type Instrument, type InstrumentId, type InstrumentRouting, type Mixer, type MixerRouting, type Numeric, type Program, type Section, type Track, type Unit } from '@core/program.js'
import * as ast from '../parser/ast.js'
import { busSchema, stepSchema, trackSchema } from './common.js'
import { CompileError } from './error.js'
import { getDefaultFunctions } from './functions.js'
import type { InferSchema, PropertySchema } from './schema.js'
import { BusType, EffectType, FunctionType, GroupType, InstrumentType, NumberType, PatternType, SectionType, StringType, type BusValue, type GroupValue, type InstrumentValue, type Type, type Value } from './types.js'
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
  const imports = program.imports.map((item) => item.library.value)

  const top: TopLevelContext = {
    get top () {
      return top
    },
    options,
    instruments: new Map(),
    resolutions: new Map(getDefaultFunctions(imports))
  }

  const context = createLocalScope(top)

  const assignments = program.children.filter((c) => c.type === 'Assignment')
  const tracks = program.children.filter((c) => c.type === 'TrackStatement')
  const mixers = program.children.filter((c) => c.type === 'MixerStatement')

  processAssignments(context, assignments)

  const track = tracks.length > 0
    ? generateTrack(context, tracks[0])
    : {
        tempo: makeNumeric('bpm', options.tempo.default),
        sections: []
      }

  const mixer = mixers.length > 0
    ? generateMixer(context, mixers[0])
    : { buses: [], routings: [] }

  return {
    beatsPerBar: options.beatsPerBar,
    instruments: top.instruments,
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
}

interface MutableContext extends Context {
  readonly resolutions: Map<string, Value>
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

function processAssignments (context: MutableContext, assignments: readonly ast.Assignment[]): void {
  for (const assignment of assignments) {
    assert(!context.resolutions.has(assignment.key.name))
    context.resolutions.set(assignment.key.name, resolve(context, assignment.value))
  }
}

function generateTrack (context: Context, track: ast.TrackStatement): Track {
  const { options } = context.top

  const trackContext = createLocalScope(context)

  const sections = track.sections.map((section) => generateSection(trackContext, section))
  for (const section of sections) {
    assert(!trackContext.resolutions.has(section.name))
    trackContext.resolutions.set(section.name, SectionType.of(section))
  }

  const properties = resolveProperties(trackContext, track.properties, trackSchema)

  const tempo = properties.tempo != null
    ? clamped(properties.tempo, options.tempo.minimum, options.tempo.maximum)
    : makeNumeric('bpm', options.tempo.default)

  return { tempo, sections }
}

function generateSection (context: Context, section: ast.SectionStatement): Section {
  const name = section.name.name
  const length = NumberType.with('beats').cast(resolve(context, section.length))

  const routings = section.routings.map((routing): InstrumentRouting => {
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

  return { name, length: length.data, routings }
}

function generateMixer (context: Context, mixer: ast.MixerStatement): Mixer {
  const mixerContext = createLocalScope(context)

  const buses = mixer.buses.map((bus, index) => generateBus(mixerContext, bus, index as BusId))
  for (const bus of buses) {
    assert(!mixerContext.resolutions.has(bus.name))
    mixerContext.resolutions.set(bus.name, BusType.of(bus))
  }

  const routings = mixer.routings.flatMap((routing): MixerRouting[] => {
    const source = resolve(mixerContext, routing.source)
    const destination = nonNull(buses.find((b) => b.name === routing.destination.name))

    const toRouting = (src: { type: Type['name'], id: InstrumentId | BusId }): MixerRouting => ({
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

  return { buses, routings }
}

function generateBus (context: Context, bus: ast.BusStatement, id: BusId): Bus {
  const name = bus.name.name
  const properties = resolveProperties(context, bus.properties, busSchema)

  const effects = bus.effects.map((effect) => {
    return EffectType.cast(resolve(context, effect.expression)).data
  })

  return { id, name, ...properties, effects }
}

/**
 * Resolve an expression to a value within the given context. Since this expression (or sub-expressions) may call
 * functions, the context may be updated.
 */
function resolve (context: Context, expression: ast.Expression): Value {
  switch (expression.type) {
    case 'StringLiteral':
      return StringType.of(expression.value)

    case 'NumberLiteral':
      return toNumberValue(context.top.options, expression)

    case 'Pattern':
      return PatternType.of(createPattern(expression.steps.map((step) => {
        const { value } = step

        const length = step.length != null
          ? NumberType.with(undefined).cast(resolve(context, step.length)).data
          : undefined

        const parameters = resolveArguments(context, step.parameters, stepSchema)

        if (length == null) {
          return { value, ...parameters }
        }

        return { value, length, ...parameters }
      }), 1))

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

    case 'Call': {
      const func = FunctionType.cast(resolve(context, expression.callee))
      const args = resolveArguments(context, expression.arguments, func.data.arguments)
      return func.data.invoke(context.top, args)
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
  }
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
    return PatternType.of(concatPatterns(left.data, right.data))
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

function resolveProperties<S extends PropertySchema> (context: Context, properties: readonly ast.Property[], schema: S): InferSchema<S> {
  const allowed = new Set(schema.map((s) => s.name))
  const values = properties
    .filter((p) => allowed.has(p.key.name))
    .map(({ key, value }) => [key.name, resolve(context, value).data])

  return Object.fromEntries(values) as InferSchema<S>
}

function resolveArguments<S extends PropertySchema> (context: Context, args: ReadonlyArray<ast.Expression | ast.Property>, schema: S): InferSchema<S> {
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
